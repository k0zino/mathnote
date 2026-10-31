import type { Point, PressureCurve, Rect, Stroke, StrokeTool } from './types'

export interface PenStyle {
  minWidth: number
  maxWidth: number
  /** 压感曲线指数：<1 让轻压力也能出较粗的线 */
  gamma: number
}

export const PEN_STYLE: PenStyle = { minWidth: 1.2, maxWidth: 5.4, gamma: 0.65 }
export const BALLPOINT_STYLE: PenStyle = { minWidth: 2, maxWidth: 2, gamma: 1 }
export const FOUNTAIN_STYLE: PenStyle = { minWidth: 0.8, maxWidth: 5, gamma: 1.4 }
export const HIGHLIGHTER_STYLE: PenStyle = { minWidth: 14, maxWidth: 14, gamma: 1 }

const TAU = Math.PI * 2

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function styleFor(tool: StrokeTool): PenStyle {
  if (tool === 'ballpoint') return BALLPOINT_STYLE
  if (tool === 'fountain') return FOUNTAIN_STYLE
  if (tool === 'highlighter') return HIGHLIGHTER_STYLE
  return PEN_STYLE
}

function curveValue(p: number, curve: PressureCurve): number {
  const x = clamp(p, 0, 1)
  if (x <= 0.25) return (curve[0] * x) / 0.25
  if (x <= 0.5) return curve[0] + (curve[1] - curve[0]) * ((x - 0.25) / 0.25)
  if (x <= 0.75) return curve[1] + (curve[2] - curve[1]) * ((x - 0.5) / 0.25)
  return curve[2] + (1 - curve[2]) * ((x - 0.75) / 0.25)
}

export function pressureToWidth(
  p: number,
  style: PenStyle = PEN_STYLE,
  curve?: PressureCurve,
): number {
  const t = curve
    ? curveValue(clamp(p, 0.06, 1), curve)
    : Math.pow(clamp(p, 0.06, 1), style.gamma)
  return style.minWidth + (style.maxWidth - style.minWidth) * t
}

interface Sample {
  x: number
  y: number
  w: number
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

/**
 * 把原始采样点重采样成平滑的中心线，并带上该处的线宽。
 * 快速划线时原始点距会很大，直接连线会出现折角，所以这里做 Catmull-Rom 插值。
 */
export function buildSamples(
  points: readonly Point[],
  style: PenStyle = PEN_STYLE,
  size = 1,
  curve?: PressureCurve,
): Sample[] {
  const n = points.length
  if (n === 0) return []
  if (n === 1) {
    return [
      {
        x: points[0].x,
        y: points[0].y,
        w: pressureToWidth(points[0].p, style, curve) * size,
      },
    ]
  }

  const out: Sample[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[i]
    const c = points[i + 1]
    const d = points[Math.min(n - 1, i + 2)]

    const dist = Math.hypot(c.x - b.x, c.y - b.y)
    const steps = clamp(Math.round(dist / 1.2), 1, 64)

    for (let s = 0; s < steps; s++) {
      const t = s / steps
      out.push({
        x: catmull(a.x, b.x, c.x, d.x, t),
        y: catmull(a.y, b.y, c.y, d.y, t),
        w: pressureToWidth(b.p + (c.p - b.p) * t, style, curve) * size,
      })
    }
  }

  const last = points[n - 1]
  out.push({ x: last.x, y: last.y, w: pressureToWidth(last.p, style, curve) * size })
  return out
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(r, 0.2), 0, TAU)
  ctx.fill()
}

/**
 * 沿中心线生成左右偏移轮廓。普通笔刷补圆头，荧光笔保留平直切口。
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const style = styleFor(stroke.tool)
  const size = stroke.size || 1
  const samples = buildSamples(stroke.points, style, size, stroke.curve)
  if (samples.length === 0) return

  const highlighter = stroke.tool === 'highlighter'
  ctx.save()
  ctx.fillStyle = stroke.color
  // 荧光笔整条一次性填充，避免自相交处反复叠加变脏
  if (highlighter) ctx.globalAlpha = 0.35

  if (samples.length === 1) {
    const sample = samples[0]
    if (highlighter) {
      const nibWidth = Math.max(2, size * 2)
      ctx.fillRect(sample.x - nibWidth / 2, sample.y - sample.w / 2, nibWidth, sample.w)
    } else {
      circle(ctx, sample.x, sample.y, sample.w / 2)
    }
    ctx.restore()
    return
  }

  const n = samples.length
  const left: { x: number; y: number }[] = new Array(n)
  const right: { x: number; y: number }[] = new Array(n)

  for (let i = 0; i < n; i++) {
    const prev = samples[Math.max(0, i - 1)]
    const next = samples[Math.min(n - 1, i + 1)]
    let dx = next.x - prev.x
    let dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len

    const nx = -dy
    const ny = dx
    const hw = samples[i].w / 2

    left[i] = { x: samples[i].x + nx * hw, y: samples[i].y + ny * hw }
    right[i] = { x: samples[i].x - nx * hw, y: samples[i].y - ny * hw }
  }

  ctx.beginPath()
  ctx.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y)
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y)
  ctx.closePath()
  ctx.fill()

  if (!highlighter) {
    circle(ctx, samples[0].x, samples[0].y, samples[0].w / 2)
    circle(ctx, samples[n - 1].x, samples[n - 1].y, samples[n - 1].w / 2)
  }
  ctx.restore()
}

/**
 * 实时落笔用：沿线段按固定间距盖章，O(新增距离)，不会随着笔画变长而变慢。
 */
export function stampSegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  style: PenStyle = PEN_STYLE,
  size = 1,
  curve?: PressureCurve,
): void {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const steps = Math.max(1, Math.ceil(dist / 1.2))

  ctx.beginPath()
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    const r = (pressureToWidth(a.p + (b.p - a.p) * t, style, curve) * size) / 2
    ctx.moveTo(x + r, y)
    ctx.arc(x, y, Math.max(r, 0.2), 0, TAU)
  }
  ctx.fill()
}

export function strokeBounds(stroke: Stroke): Rect {
  const style = styleFor(stroke.tool)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 }

  const pad = (style.maxWidth * (stroke.size || 1)) / 2 + 1
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}

function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = clamp(t, 0, 1)
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

export function strokeHit(stroke: Stroke, x: number, y: number, threshold: number): boolean {
  const b = strokeBounds(stroke)
  if (x < b.x - threshold || y < b.y - threshold) return false
  if (x > b.x + b.w + threshold || y > b.y + b.h + threshold) return false

  const pts = stroke.points
  if (pts.length === 0) return false
  if (pts.length === 1) return Math.hypot(x - pts[0].x, y - pts[0].y) <= threshold + 2

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const c = pts[i]
    if (segmentDistance(x, y, a.x, a.y, c.x, c.y) <= threshold) return true
  }
  return false
}

export function drawStrokesRegion(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  rect: Rect,
): void {
  for (const s of strokes) {
    const b = strokeBounds(s)
    if (b.x > rect.x + rect.w || b.x + b.w < rect.x) continue
    if (b.y > rect.y + rect.h || b.y + b.h < rect.y) continue
    drawStroke(ctx, s)
  }
}

/**
 * 以任意倍率把某个矩形区域重新栅格化（不是从屏幕画布上裁剪）。
 * 这样导出的选区永远是矢量重绘，缩放到 3x 也不会糊。
 */
export function renderRegion(
  strokes: readonly Stroke[],
  rect: Rect,
  scale: number,
  background = '#ffffff',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(rect.w * scale))
  canvas.height = Math.max(1, Math.ceil(rect.h * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale)
  drawStrokesRegion(ctx, strokes, rect)

  return canvas
}
