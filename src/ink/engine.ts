import { isWritingTool } from './types'
import type { Point, Rect, Selection, Stroke, StrokeTool, Tool } from './types'
import { drawStroke, pressureToWidth, stampSegment, strokeHit, styleFor } from './render'
import { cloneToolStyles, type ToolStyle } from './brushes'

export type { ToolStyle } from './brushes'

export interface Stats {
  fps: number
  eps: number
  latAvg: number
  latP95: number
  points: number
  pressure: number
}

export interface InkElements {
  page: HTMLElement
  committed: HTMLCanvasElement
  live: HTMLCanvasElement
  overlay: HTMLCanvasElement
}

/** 文档坐标 = 未缩放的页面 CSS 像素 */
export const PAGE_WIDTH = 820
export const PAGE_HEIGHT = 1160

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const TAU = Math.PI * 2

const SELECT_PADDING = 14

export class InkEngine {
  private readonly page: HTMLElement
  private readonly committed: HTMLCanvasElement
  private readonly live: HTMLCanvasElement
  private readonly overlay: HTMLCanvasElement

  private readonly committedCtx: CanvasRenderingContext2D
  private readonly liveCtx: CanvasRenderingContext2D
  private readonly overlayCtx: CanvasRenderingContext2D

  private strokes: Stroke[] = []
  private undoStack: Stroke[][] = []

  private tool: Tool = 'pen'
  private toolStyles: Record<StrokeTool, ToolStyle> = cloneToolStyles()
  private eraserRadius = 12
  private barrelEraser = true
  private accentColor = '#3b64dc'
  private penOnly = false
  private lastPenTs = -Infinity
  private zoom = 1
  private baseWidth = PAGE_WIDTH
  private baseHeight = PAGE_HEIGHT

  private drawing = false
  private current: Stroke | null = null
  private activePointer: number | null = null

  private selecting = false
  private selectionMode: 'rect' | 'lasso' = 'rect'
  private selStart = { x: 0, y: 0 }
  private selRect: Rect | null = null
  private lassoPoints: Point[] = []

  private erasing = false
  private eraseUndoPushed = false

  /** Chromium 支持 pointerrawupdate，能拿到更早、更密的原始事件 */
  private readonly hasRaw: boolean

  private frameCount = 0
  private eventCount = 0
  private latencies: number[] = []
  private lastPressure = 0
  private statsTimer = 0
  private started = false

  onSelection: ((selection: Selection) => void) | null = null
  onStats: ((stats: Stats) => void) | null = null
  onChange: (() => void) | null = null

  constructor(elements: InkElements) {
    this.page = elements.page
    this.committed = elements.committed
    this.live = elements.live
    this.overlay = elements.overlay

    const committedCtx = this.committed.getContext('2d')
    const liveCtx = this.live.getContext('2d')
    const overlayCtx = this.overlay.getContext('2d')
    if (!committedCtx || !liveCtx || !overlayCtx) {
      throw new Error('无法创建 2D canvas context')
    }
    this.committedCtx = committedCtx
    this.liveCtx = liveCtx
    this.overlayCtx = overlayCtx

    this.hasRaw = 'onpointerrawupdate' in window
  }

  start(): void {
    if (this.started) return
    this.started = true

    this.resize()

    const page = this.page
    page.addEventListener('pointerdown', this.onDown)
    page.addEventListener('pointermove', this.onMove)
    page.addEventListener('pointerup', this.onUp)
    page.addEventListener('pointercancel', this.onUp)
    page.addEventListener('contextmenu', (e) => e.preventDefault())

    if (this.hasRaw) {
      page.addEventListener('pointerrawupdate' as never, this.onRaw as EventListener)
    }

    const tick = () => {
      this.frameCount++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    this.statsTimer = window.setInterval(() => this.flushStats(), 500)
  }

  dispose(): void {
    window.clearInterval(this.statsTimer)
    const page = this.page
    page.removeEventListener('pointerdown', this.onDown)
    page.removeEventListener('pointermove', this.onMove)
    page.removeEventListener('pointerup', this.onUp)
    page.removeEventListener('pointercancel', this.onUp)
    if (this.hasRaw) {
      page.removeEventListener('pointerrawupdate' as never, this.onRaw as EventListener)
    }
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    const cssW = this.baseWidth * this.zoom
    const cssH = this.baseHeight * this.zoom

    this.page.style.width = `${cssW}px`
    this.page.style.height = `${cssH}px`

    for (const canvas of [this.committed, this.live, this.overlay]) {
      canvas.width = Math.max(1, Math.round(cssW * dpr))
      canvas.height = Math.max(1, Math.round(cssH * dpr))
    }

    const scale = this.zoom * dpr
    for (const ctx of [this.committedCtx, this.liveCtx, this.overlayCtx]) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }

    this.clearLive()
    this.clearOverlay()
    this.redrawAll()
  }

  setZoom(zoom: number): void {
    const next = clamp(zoom, 0.2, 3)
    if (next === this.zoom) return
    this.zoom = next
    this.resize()
  }

  getZoom(): number {
    return this.zoom
  }

  getPageSize(): { w: number; h: number } {
    return { w: this.baseWidth, h: this.baseHeight }
  }

  setTool(tool: Tool): void {
    this.tool = tool
    this.cancelGesture()
  }

  getTool(): Tool {
    return this.tool
  }

  setToolStyle(tool: StrokeTool, style: Partial<ToolStyle>): void {
    const current = this.toolStyles[tool]
    this.toolStyles[tool] = {
      color: style.color ?? current.color,
      size: clamp(style.size ?? current.size, 0.4, 3),
      curve: style.curve ? [...style.curve] : current.curve,
    }
  }

  getToolStyle(tool: StrokeTool): ToolStyle {
    const style = this.toolStyles[tool]
    return { ...style, curve: [...style.curve] }
  }

  setEraserRadius(radius: number): void {
    this.eraserRadius = clamp(radius, 4, 48)
  }

  setBarrelEraser(enabled: boolean): void {
    this.barrelEraser = enabled
  }

  setAccentColor(color: string): void {
    this.accentColor = color
  }

  isInteracting(): boolean {
    return this.drawing || this.erasing || this.selecting
  }

  setPenOnly(enabled: boolean): void {
    this.penOnly = enabled
  }

  getStrokes(): readonly Stroke[] {
    return this.strokes
  }

  loadStrokes(
    strokes: readonly Stroke[],
    width = this.baseWidth,
    height = this.baseHeight,
  ): void {
    this.cancelGesture()
    this.baseWidth = width
    this.baseHeight = height
    this.strokes = strokes.slice()
    this.undoStack = []
    this.resize()
  }

  undo(): void {
    const prev = this.undoStack.pop()
    if (!prev) return
    this.strokes = prev
    this.redrawAll()
    this.notifyChange()
  }

  clear(): void {
    if (this.strokes.length === 0) return
    this.pushUndo()
    this.strokes = []
    this.redrawAll()
    this.notifyChange()
  }

  private notifyChange(): void {
    this.onChange?.()
  }

  // ---------------------------------------------------------------- pointer

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.accept(e)) return
    if (e.pointerType === 'pen' || e.pointerType === 'eraser') {
      this.lastPenTs = performance.now()
    }

    const pt = this.toPoint(e, true)
    this.page.setPointerCapture(e.pointerId)
    this.activePointer = e.pointerId

    // 数位笔橡皮端 / 橡皮按钮：临时擦除，不改变当前工具
    if (this.isEraserEvent(e)) {
      this.erasing = true
      this.eraseUndoPushed = false
      this.eraseAt(pt.x, pt.y)
      return
    }

    if (isWritingTool(this.tool)) {
      const strokeTool: StrokeTool = this.tool
      const style = this.toolStyles[strokeTool]
      this.drawing = true
      this.current = {
        points: [pt],
        color: style.color,
        size: style.size,
        tool: strokeTool,
        curve: style.curve,
      }
      if (strokeTool === 'highlighter') {
        this.renderLiveStroke()
      } else {
        this.liveCtx.fillStyle = style.color
        this.drawDot(pt, style)
      }
      this.record(e, pt.p)
      return
    }

    if (this.tool === 'select' || this.tool === 'lasso') {
      this.selecting = true
      this.selectionMode = this.tool === 'lasso' ? 'lasso' : 'rect'
      this.selStart = { x: pt.x, y: pt.y }
      this.selRect = { x: pt.x, y: pt.y, w: 0, h: 0 }
      this.lassoPoints = this.selectionMode === 'lasso' ? [pt] : []
      this.drawSelection()
      return
    }

    this.erasing = true
    this.eraseUndoPushed = false
    this.eraseAt(pt.x, pt.y)
  }

  private readonly onMove = (e: PointerEvent): void => {
    if (this.hasRaw) return
    this.handleMove(e)
  }

  private readonly onRaw = (e: Event): void => {
    this.handleMove(e as PointerEvent)
  }

  private handleMove(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return

    if (this.drawing) {
      for (const ev of this.coalesce(e)) this.extend(ev)
      return
    }

    if (this.selecting) {
      if (this.selectionMode === 'lasso') this.updateLasso(e)
      else this.updateSelection(e)
      return
    }

    if (this.erasing) {
      const pt = this.toPoint(e, false)
      this.eraseAt(pt.x, pt.y)
    }
  }

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer) return

    if (this.drawing) this.finishStroke()
    else if (this.selecting) this.finishSelection()
    else if (this.erasing) this.erasing = false

    this.activePointer = null
    try {
      this.page.releasePointerCapture(e.pointerId)
    } catch {
      // 指针可能已经释放
    }
  }

  private cancelGesture(): void {
    if (this.drawing) {
      this.drawing = false
      this.current = null
      this.clearLive()
    }
    this.selecting = false
    this.erasing = false
    this.activePointer = null
    this.lassoPoints = []
    this.clearOverlay()
  }

  private accept(e: PointerEvent): boolean {
    // 手掌 / 触摸屏一律忽略（后续可以做成「触摸只用于滚动」）
    if (e.pointerType === 'touch') return false

    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return false
      // 笔刚离开时，鼠标事件常常是同一支笔的模拟事件
      if (performance.now() - this.lastPenTs < 1200) return false
    }

    // 数位笔的非主按钮：只接受橡皮端/橡皮按钮，其他侧键不画线
    if (e.pointerType === 'pen' && e.button !== 0 && !this.isEraserEvent(e)) {
      return false
    }

    if (this.penOnly && e.pointerType !== 'pen' && e.pointerType !== 'eraser') {
      return false
    }
    return true
  }

  /** 数位笔橡皮端，或笔杆上的橡皮按钮 */
  private isEraserEvent(e: PointerEvent): boolean {
    if (e.pointerType === 'eraser') return true
    if (e.pointerType !== 'pen') return false
    if (e.button === 5 || (e.buttons & 32) !== 0) return true
    return this.barrelEraser && e.button === 2
  }

  private coalesce(e: PointerEvent): PointerEvent[] {
    if (typeof e.getCoalescedEvents !== 'function') return [e]
    const list = e.getCoalescedEvents()
    return list.length > 0 ? list : [e]
  }

  private toPoint(e: PointerEvent, first: boolean): Point {
    const rect = this.page.getBoundingClientRect()
    let p: number

    if (e.pointerType === 'mouse') {
      p = 0.5
    } else {
      p = clamp(e.pressure, 0.05, 1)
      // 很多数位板落笔第一帧压力为 0，直接用会起笔成一个尖
      if (first && p < 0.25) p = 0.25
    }

    return {
      x: (e.clientX - rect.left) / this.zoom,
      y: (e.clientY - rect.top) / this.zoom,
      p,
      t: e.timeStamp,
    }
  }

  private extend(e: PointerEvent): void {
    const stroke = this.current
    if (!stroke) return

    const pt = this.toPoint(e, false)
    const last = stroke.points[stroke.points.length - 1]
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.3) return

    stroke.points.push(pt)

    if (stroke.tool === 'highlighter') {
      // 半透明笔迹不能增量叠加，否则自相交处会越来越脏
      this.renderLiveStroke()
    } else if (last) {
      this.liveCtx.fillStyle = stroke.color
      stampSegment(this.liveCtx, last, pt, styleFor(stroke.tool), stroke.size, stroke.curve)
    }
    this.record(e, pt.p)
  }

  private drawDot(pt: Point, style: ToolStyle): void {
    const penStyle = styleFor(this.current?.tool ?? 'pen')
    const r = (pressureToWidth(pt.p, penStyle, style.curve) * style.size) / 2
    this.liveCtx.beginPath()
    this.liveCtx.arc(pt.x, pt.y, Math.max(r, 0.3), 0, TAU)
    this.liveCtx.fill()
  }

  private renderLiveStroke(): void {
    if (!this.current) return
    this.clearLive()
    drawStroke(this.liveCtx, this.current)
  }

  private finishStroke(): void {
    const stroke = this.current
    this.current = null
    this.drawing = false
    if (!stroke) return

    this.pushUndo()
    this.strokes.push(stroke)
    this.clearLive()
    drawStroke(this.committedCtx, stroke)
    this.notifyChange()
  }

  // -------------------------------------------------------------- selection

  private updateSelection(e: PointerEvent): void {
    const pt = this.toPoint(e, false)
    const x = Math.min(this.selStart.x, pt.x)
    const y = Math.min(this.selStart.y, pt.y)
    this.selRect = {
      x,
      y,
      w: Math.abs(pt.x - this.selStart.x),
      h: Math.abs(pt.y - this.selStart.y),
    }
    this.drawSelection()
  }

  private updateLasso(e: PointerEvent): void {
    const pt = this.toPoint(e, false)
    const last = this.lassoPoints[this.lassoPoints.length - 1]
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return

    this.lassoPoints.push(pt)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const point of this.lassoPoints) {
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    }

    this.selRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    this.drawSelection()
  }

  private drawSelection(): void {
    const ctx = this.overlayCtx
    this.clearOverlay()
    const r = this.selRect
    if (!r) return

    ctx.save()
    ctx.fillStyle = this.accentColor
    ctx.globalAlpha = 0.07
    ctx.strokeStyle = this.accentColor
    ctx.lineWidth = 1.2 / this.zoom

    if (this.selectionMode === 'lasso' && this.lassoPoints.length > 1) {
      ctx.beginPath()
      ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y)
      for (let i = 1; i < this.lassoPoints.length; i++) {
        ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
    } else {
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.globalAlpha = 1
      ctx.setLineDash([5 / this.zoom, 4 / this.zoom])
      ctx.strokeRect(r.x, r.y, Math.max(r.w, 0), Math.max(r.h, 0))
    }
    ctx.restore()
  }

  private finishSelection(): void {
    const rect = this.selRect
    const polygon =
      this.selectionMode === 'lasso' && this.lassoPoints.length > 2
        ? this.lassoPoints.slice()
        : undefined

    this.selecting = false
    this.selRect = null
    this.lassoPoints = []
    this.clearOverlay()
    if (!rect || rect.w < 4 || rect.h < 4) return

    const x = Math.max(0, rect.x - SELECT_PADDING)
    const y = Math.max(0, rect.y - SELECT_PADDING)
    const w = Math.min(this.baseWidth - x, rect.w + SELECT_PADDING * 2)
    const h = Math.min(this.baseHeight - y, rect.h + SELECT_PADDING * 2)

    this.onSelection?.({ rect: { x, y, w, h }, polygon })
  }

  // ----------------------------------------------------------------- eraser

  private eraseAt(x: number, y: number): void {
    const index = this.strokes.findIndex((s) => strokeHit(s, x, y, this.eraserRadius))
    if (index < 0) return

    if (!this.eraseUndoPushed) {
      this.pushUndo()
      this.eraseUndoPushed = true
    }
    this.strokes.splice(index, 1)
    this.redrawAll()
    this.notifyChange()
  }

  // ---------------------------------------------------------------- drawing

  private pushUndo(): void {
    this.undoStack.push(this.strokes.slice())
    if (this.undoStack.length > 120) this.undoStack.shift()
  }

  private redrawAll(): void {
    const ctx = this.committedCtx
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.committed.width, this.committed.height)
    ctx.restore()

    for (const stroke of this.strokes) {
      drawStroke(ctx, stroke)
    }
  }

  private clearLive(): void {
    const ctx = this.liveCtx
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.live.width, this.live.height)
    ctx.restore()
  }

  private clearOverlay(): void {
    const ctx = this.overlayCtx
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height)
    ctx.restore()
  }

  // ------------------------------------------------------------------ stats

  private record(e: PointerEvent, pressure: number): void {
    this.eventCount++
    this.lastPressure = pressure

    const latency = performance.now() - e.timeStamp
    if (Number.isFinite(latency) && latency >= 0 && latency < 500) {
      this.latencies.push(latency)
      if (this.latencies.length > 600) this.latencies.shift()
    }
  }

  private flushStats(): void {
    const fps = this.frameCount * 2
    const eps = this.eventCount * 2
    this.frameCount = 0
    this.eventCount = 0

    let latAvg = 0
    let latP95 = 0
    if (this.latencies.length > 0) {
      const sorted = [...this.latencies].sort((a, b) => a - b)
      latAvg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length
      latP95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    }

    this.onStats?.({
      fps,
      eps,
      latAvg,
      latP95,
      points: this.strokes.reduce((sum, s) => sum + s.points.length, 0),
      pressure: this.lastPressure,
    })
  }
}
