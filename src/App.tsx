import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { InkEngine, type Stats } from './ink/engine'
import type { Selection, StrokeTool, Tool } from './ink/types'
import {
  createPage,
  createPageForMode,
  paperModeForPages,
  type PaperMode,
  type PageData,
} from './notebook'
import { backend, DEFAULT_SETTINGS, type AiSettings, type Attachment } from './ipc'
import { getPdfPageSize, loadPdf, type PdfSource } from './pdf'
import { renderPageRegion } from './pageRender'
import { packNotebook, unpackNotebook } from './document'
import {
  addRecent,
  loadPreferences,
  removeRecent,
  savePreferences,
  type AppPreferences,
} from './preferences'
import { TitleBar } from './ui/TitleBar'
import { Toolbar } from './ui/Toolbar'
import { PageSidebar } from './ui/PageSidebar'
import { PagePreview } from './ui/PagePreview'
import { PdfBackground } from './ui/PdfBackground'
import { AiPanel } from './ui/AiPanel'
import { SettingsDialog } from './ui/SettingsDialog'
import { AppearanceDialog } from './ui/AppearanceDialog'
import { HomeScreen } from './ui/HomeScreen'
import { LeaveDialog } from './ui/LeaveDialog'
import { Hud } from './ui/Hud'

const PAGE_GAP = 26
const PAGE_PAD_X = 44
const PAGE_PAD_Y = 84

interface PageLayoutItem {
  top: number
  left: number
  width: number
  height: number
}

interface PageLayout {
  width: number
  height: number
  items: PageLayoutItem[]
}

function buildPageLayout(pages: readonly PageData[], zoom: number): PageLayout {
  let maxWidth = 0
  for (const page of pages) maxWidth = Math.max(maxWidth, page.width)

  const width = maxWidth * zoom + PAGE_PAD_X * 2
  let top = PAGE_PAD_Y
  const items = pages.map((page) => {
    const itemWidth = page.width * zoom
    const itemHeight = page.height * zoom
    const item = {
      top,
      left: (width - itemWidth) / 2,
      width: itemWidth,
      height: itemHeight,
    }
    top += itemHeight + PAGE_GAP
    return item
  })

  return {
    width,
    height: Math.max(top - PAGE_GAP + PAGE_PAD_Y, PAGE_PAD_Y * 2),
    items,
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<AppPreferences>(() => loadPreferences())
  const [view, setView] = useState<'home' | 'editor'>('home')
  const [themeOpen, setThemeOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [debug, setDebug] = useState(false)
  const [maximized, setMaximized] = useState(false)

  const [docName, setDocName] = useState('未命名笔记')
  const [dirty, setDirty] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<PaperMode>('portrait')

  const [tool, setTool] = useState<Tool>('pen')
  const toolStyles = prefs.brushes
  const [eraserRadius, setEraserRadius] = useState(12)
  const [barrelEraser, setBarrelEraser] = useState(true)
  const [zoom, setZoom] = useState(1)

  const [pageIndex, setPageIndexState] = useState(0)
  const [pageVersion, setPageVersion] = useState(0)
  const [revealTick, setRevealTick] = useState(0)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS)
  const [stats, setStats] = useState<Stats | null>(null)

  const pagesRef = useRef<PageData[]>([createPageForMode('portrait')])
  const pdfMapRef = useRef(new Map<string, PdfSource>())
  const pageIndexRef = useRef(0)
  const debugRef = useRef(false)
  const userZoomedRef = useRef(false)
  const zoomRef = useRef(1)
  const noticeTimerRef = useRef(0)
  const dirtyRef = useRef(false)
  const docNameRef = useRef('未命名笔记')
  const orientationRef = useRef<PaperMode>('portrait')
  const viewRef = useRef<'home' | 'editor'>('home')
  const filePathRef = useRef<string | null>(null)
  const pageLayoutRef = useRef<PageLayout>(buildPageLayout(pagesRef.current, 1))
  const revealRequestRef = useRef<{ index: number; center: boolean } | null>(null)

  const workspaceRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const committedRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<InkEngine | null>(null)

  debugRef.current = debug
  dirtyRef.current = dirty
  docNameRef.current = docName
  orientationRef.current = orientation
  viewRef.current = view
  zoomRef.current = zoom

  const pageLayout = buildPageLayout(pagesRef.current, zoom)
  pageLayoutRef.current = pageLayout

  function markDirty() {
    dirtyRef.current = true
    setDirty(true)
  }

  function markSaved() {
    dirtyRef.current = false
    setDirty(false)
  }

  function setPageIndex(index: number) {
    pageIndexRef.current = index
    setPageIndexState(index)
  }

  function showNotice(text: string) {
    setNotice(text)
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4000)
  }

  function recordRecent(path: string, name: string, pageCount: number, mode: PaperMode) {
    setPrefs((prev) => ({
      ...prev,
      recents: addRecent(prev.recents, {
        path,
        name,
        pageCount,
        orientation: mode,
        updatedAt: Date.now(),
      }),
    }))
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', prefs.themeColor)
    engineRef.current?.setAccentColor(prefs.themeColor)
  }, [prefs.themeColor])

  useEffect(() => {
    savePreferences(prefs)
  }, [prefs])

  function flushCurrentPage() {
    const engine = engineRef.current
    if (!engine) return
    const page = pagesRef.current[pageIndexRef.current]
    if (page) page.strokes = [...engine.getStrokes()]
  }

  function getPdfForPage(page: PageData): PdfSource | undefined {
    return page.background ? pdfMapRef.current.get(page.background.pdfId) : undefined
  }

  function handleSelection(selection: Selection) {
    const engine = engineRef.current
    if (!engine) return

    const { rect, polygon } = selection
    const page = pagesRef.current[pageIndexRef.current]
    const snapshot: PageData = { ...page, strokes: [...engine.getStrokes()] }
    // 长边目标 1600px：手写下标在这个分辨率下才看得清
    const scale = Math.min(4, Math.max(2, 1600 / Math.max(rect.w, rect.h)))

    void renderPageRegion(snapshot, getPdfForPage(snapshot), rect, scale, true, polygon)
      .then((canvas) => {
        const dataUrl = canvas.toDataURL('image/png')
        setAttachments((prev) => [...prev, { id: crypto.randomUUID(), dataUrl }])
        setAiOpen(true)
      })
      .catch((error) => {
        console.error('选区导出失败', error)
        showNotice('选区导出失败，请重试')
      })
  }

  function fitWorkspace() {
    const page = pagesRef.current[pageIndexRef.current]
    if (!page) return

    if (page.infinite) {
      userZoomedRef.current = false
      setZoom(1)
      return
    }

    const workspace = workspaceRef.current
    if (!workspace) return
    const available = Math.max(120, workspace.clientWidth - PAGE_PAD_X * 2)
    const next = Math.min(1, Math.max(0.2, available / page.width))
    setZoom(Math.round(next * 100) / 100)
  }

  function revealPage(index: number, center = false) {
    let tries = 0

    const apply = () => {
      tries += 1
      const scroll = scrollRef.current
      const item = pageLayoutRef.current.items[index]
      const page = pagesRef.current[index]
      if (!scroll) return
      if (!item || !page) {
        if (tries < 20) window.setTimeout(apply, 16)
        return
      }

      let targetLeft: number
      let targetTop: number
      if (center || page.infinite) {
        targetLeft = item.left + item.width / 2 - scroll.clientWidth / 2
        targetTop = item.top + item.height / 2 - scroll.clientHeight / 2
      } else {
        targetLeft = item.left - 24
        targetTop = item.top - 24
      }

      const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
      const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight)
      const clampedLeft = Math.max(0, Math.min(targetLeft, maxLeft))
      const clampedTop = Math.max(0, Math.min(targetTop, maxTop))

      // 新页面刚插入时滚动区域可能还没撑开，等一两帧再滚
      const waitingForLayout =
        tries < 20 &&
        (Math.abs(clampedLeft - targetLeft) > 2 || Math.abs(clampedTop - targetTop) > 2)

      if (waitingForLayout) {
        window.setTimeout(apply, 16)
        return
      }

      scroll.scrollLeft = clampedLeft
      scroll.scrollTop = clampedTop
    }

    window.setTimeout(apply, 0)
  }

  function setManualZoom(next: number) {
    userZoomedRef.current = true
    const maxZoom = pagesRef.current[pageIndexRef.current]?.infinite ? 1.5 : 3
    setZoom(Math.min(maxZoom, Math.max(0.2, Math.round(next * 10) / 10)))
    requestReveal(pageIndexRef.current, pagesRef.current[pageIndexRef.current]?.infinite)
  }

  function requestReveal(index: number, center = false) {
    revealRequestRef.current = { index, center }
    setRevealTick((value) => value + 1)
  }

  function refitSoon() {
    requestAnimationFrame(() => {
      engineRef.current?.resize()
      if (!userZoomedRef.current) fitWorkspace()
      requestReveal(
        pageIndexRef.current,
        pagesRef.current[pageIndexRef.current]?.infinite,
      )
    })
  }

  useEffect(() => {
    const request = revealRequestRef.current
    if (!request) return
    revealRequestRef.current = null
    revealPage(request.index, request.center)
  }, [revealTick])

  // ------------------------------------------------------------- 引擎生命周期

  useEffect(() => {
    if (!pageRef.current) return

    const engine = new InkEngine({
      page: pageRef.current,
      committed: committedRef.current!,
      live: liveRef.current!,
      overlay: overlayRef.current!,
    })
    engineRef.current = engine

    engine.onChange = () => {
      flushCurrentPage()
      markDirty()
      setPageVersion((v) => v + 1)
    }
    engine.onStats = (value) => {
      if (debugRef.current) setStats(value)
    }
    engine.onSelection = handleSelection

    engine.start()
    engine.setAccentColor(prefs.themeColor)
    const page = pagesRef.current[pageIndexRef.current]
    engine.loadStrokes(page.strokes, page.width, page.height)

    if (import.meta.env.DEV) {
      ;(window as unknown as { __mathnoteEngine?: InkEngine }).__mathnoteEngine = engine
    }

    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setTool(tool)
  }, [tool])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    for (const [name, style] of Object.entries(toolStyles)) {
      engine.setToolStyle(name as StrokeTool, style)
    }
  }, [toolStyles])

  useEffect(() => {
    engineRef.current?.setEraserRadius(eraserRadius)
  }, [eraserRadius])

  useEffect(() => {
    engineRef.current?.setBarrelEraser(barrelEraser)
  }, [barrelEraser])

  useEffect(() => {
    engineRef.current?.setZoom(zoom)
  }, [zoom])

  useEffect(() => {
    if (!userZoomedRef.current) fitWorkspace()
    requestReveal(pageIndexRef.current, pagesRef.current[pageIndexRef.current]?.infinite)
  }, [sidebarOpen, aiOpen])

  useEffect(() => {
    if (view !== 'editor') return
    const frame = requestAnimationFrame(() => {
      engineRef.current?.resize()
      if (!userZoomedRef.current) fitWorkspace()
      requestReveal(
        pageIndexRef.current,
        pagesRef.current[pageIndexRef.current]?.infinite,
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [view])

  useEffect(() => {
    const onResize = () => {
      engineRef.current?.resize()
      if (!userZoomedRef.current) fitWorkspace()
      requestReveal(
        pageIndexRef.current,
        pagesRef.current[pageIndexRef.current]?.infinite,
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Ctrl/⌘ + 滚轮缩放，保持鼠标下的文档坐标不动
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()

      const page = pageRef.current
      const engine = engineRef.current
      if (!page || !engine) return

      const previous = zoomRef.current
      const factor = Math.exp(-event.deltaY * 0.0015)
      const maxZoom = pagesRef.current[pageIndexRef.current]?.infinite ? 1.5 : 3
      const next = Math.min(
        maxZoom,
        Math.max(0.2, Math.round(previous * factor * 100) / 100),
      )
      if (next === previous) return

      const scrollRect = scroll.getBoundingClientRect()
      const item = pageLayoutRef.current.items[pageIndexRef.current]
      if (!item) return
      const docX =
        (scroll.scrollLeft + event.clientX - scrollRect.left - item.left) / previous
      const docY =
        (scroll.scrollTop + event.clientY - scrollRect.top - item.top) / previous

      userZoomedRef.current = true
      engine.setZoom(next)
      setZoom(next)

      const nextItem = buildPageLayout(pagesRef.current, next).items[pageIndexRef.current]
      requestAnimationFrame(() => {
        scroll.scrollLeft = Math.max(
          0,
          nextItem.left + docX * next - (event.clientX - scrollRect.left),
        )
        scroll.scrollTop = Math.max(
          0,
          nextItem.top + docY * next - (event.clientY - scrollRect.top),
        )
      })
    }

    scroll.addEventListener('wheel', onWheel, { passive: false })
    return () => scroll.removeEventListener('wheel', onWheel)
  }, [])

  // 连续滚动：视口中心落到哪一页，就把哪一页设为活动页
  function handleScroll() {
    const scroll = scrollRef.current
    if (!scroll) return
    if (engineRef.current?.isInteracting()) return

    const layout = pageLayoutRef.current
    const center = scroll.scrollTop + scroll.clientHeight / 2
    let best = pageIndexRef.current
    let bestDistance = Infinity

    layout.items.forEach((item, index) => {
      const distance = Math.abs(item.top + item.height / 2 - center)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })

    if (best !== pageIndexRef.current) goToPage(best)
  }

  useEffect(() => {
    if (view !== 'editor') return
    const page = pagesRef.current[pageIndexRef.current]
    if (!page?.infinite) return
    userZoomedRef.current = false
    setZoom(1)
    requestReveal(pageIndexRef.current, true)
  }, [view, pageIndex])

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), [])

  // ------------------------------------------------------------------ 窗口

  useEffect(() => {
    const controls = backend()?.windowControls
    if (!controls) return
    controls.isMaximized().then(setMaximized).catch(() => {})
    return controls.onMaximizeChange(setMaximized)
  }, [])

  useEffect(() => {
    backend()?.setDocumentDirty(dirty)
  }, [dirty])

  // ------------------------------------------------------------------ 设置

  useEffect(() => {
    backend()
      ?.getSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])

  async function saveSettings(next: AiSettings) {
    setSettings(next)
    setSettingsOpen(false)
    try {
      await backend()?.setSettings(next)
    } catch {
      // 保存失败时保留内存中的配置
    }
  }

  // ------------------------------------------------------------- 文档保存/打开

  async function saveDocument(saveAs = false): Promise<boolean> {
    try {
      flushCurrentPage()
      const usedPdfIds = new Set(
        pagesRef.current
          .map((page) => page.background?.pdfId)
          .filter((id): id is string => Boolean(id)),
      )
      const pdfs = [...pdfMapRef.current.values()].filter((pdf) => usedPdfIds.has(pdf.id))
      const data = packNotebook({
        name: docNameRef.current,
        currentPage: pageIndexRef.current,
        orientation: orientationRef.current,
        pages: pagesRef.current,
        pdfs,
      })

      const api = backend()
      if (api) {
        const result = await api.saveDocument({
          data,
          filePath: saveAs ? null : filePathRef.current,
          suggestedName: docNameRef.current,
        })
        if (!result) return false
        filePathRef.current = result.path
        const savedName = result.name.replace(/\.mnote$/i, '')
        setDocName(savedName)
        recordRecent(
          result.path,
          savedName,
          pagesRef.current.length,
          orientationRef.current,
        )
      } else {
        const copy = data.slice()
        const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/zip' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${docNameRef.current || '未命名笔记'}.mnote`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }

      markSaved()
      showNotice('笔记已保存')
      return true
    } catch (error) {
      console.error('保存笔记失败', error)
      showNotice(`保存失败：${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async function confirmDiscardIfNeeded(): Promise<boolean> {
    if (!dirtyRef.current) return true
    const api = backend()
    if (api) return api.confirmDiscard()
    return window.confirm('当前笔记有未保存的修改，继续操作会丢弃这些修改。')
  }

  async function loadNotebook(data: Uint8Array, filePath: string | null) {
    setImporting(true)
    try {
      const notebook = await unpackNotebook(data)
      pagesRef.current = notebook.pages
      pdfMapRef.current = new Map(notebook.pdfs.map((pdf) => [pdf.id, pdf] as const))

      const page = pagesRef.current[notebook.currentPage]
      engineRef.current?.loadStrokes(page.strokes, page.width, page.height)
      filePathRef.current = filePath
      orientationRef.current = notebook.orientation
      userZoomedRef.current = false
      setPageIndex(notebook.currentPage)
      setOrientation(notebook.orientation)
      setDocName(notebook.name)
      setAttachments([])
      setView('editor')
      markSaved()
      setPageVersion((v) => v + 1)
      if (filePath) {
        recordRecent(filePath, notebook.name, notebook.pages.length, notebook.orientation)
      }
      refitSoon()
      showNotice(`已打开 ${notebook.pages.length} 页笔记`)
    } catch (error) {
      console.error('打开笔记失败', error)
      showNotice(`打开失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setImporting(false)
    }
  }

  async function openDocument() {
    const api = backend()
    if (!api) {
      documentInputRef.current?.click()
      return
    }

    try {
      const result = await api.openDocument()
      if (!result) return
      if (!(await confirmDiscardIfNeeded())) return
      await loadNotebook(new Uint8Array(result.data), result.path)
    } catch (error) {
      console.error('打开笔记失败', error)
      showNotice('无法打开笔记文件')
    }
  }

  async function openRecent(path: string) {
    if (!(await confirmDiscardIfNeeded())) return
    const api = backend()
    if (!api) return

    try {
      const result = await api.openDocumentPath(path)
      if (!result) {
        showNotice('找不到这个笔记文件')
        return
      }
      await loadNotebook(new Uint8Array(result.data), result.path)
    } catch (error) {
      console.error('打开最近笔记失败', error)
      showNotice('无法打开最近笔记，文件可能已被移动')
    }
  }

  function goHome() {
    flushCurrentPage()
    if (dirtyRef.current) setLeaveOpen(true)
    else enterHome()
  }

  function enterHome() {
    const page = createPageForMode(orientationRef.current)
    pagesRef.current = [page]
    pdfMapRef.current.clear()
    engineRef.current?.loadStrokes(page.strokes, page.width, page.height)
    filePathRef.current = null
    userZoomedRef.current = false
    setPageIndex(0)
    setDocName('未命名笔记')
    setAttachments([])
    setLeaveOpen(false)
    markSaved()
    setPageVersion((v) => v + 1)
    setView('home')
  }

  async function leaveAndSave() {
    if (await saveDocument()) enterHome()
  }

  function leaveAndDiscard() {
    enterHome()
  }

  async function newDocument(mode: PaperMode = orientationRef.current) {
    if (!(await confirmDiscardIfNeeded())) return

    const page = createPageForMode(mode)
    pagesRef.current = [page]
    pdfMapRef.current.clear()
    engineRef.current?.loadStrokes(page.strokes, page.width, page.height)
    filePathRef.current = null
    orientationRef.current = mode
    userZoomedRef.current = false
    setPageIndex(0)
    setOrientation(mode)
    setDocName('未命名笔记')
    setAttachments([])
    setView('editor')
    markSaved()
    setPageVersion((v) => v + 1)
    refitSoon()
    showNotice('已新建空白笔记')
  }

  // --------------------------------------------------------------- PDF 导入

  async function importPdf(data: Uint8Array, name: string) {
    setImporting(true)
    try {
      const source = await loadPdf(data, name)
      pdfMapRef.current.set(source.id, source)

      const imported: PageData[] = []
      for (let pageNumber = 1; pageNumber <= source.document.numPages; pageNumber++) {
        const pageSize = await getPdfPageSize(source.document, pageNumber)
        imported.push(
          createPage(pageSize.width, pageSize.height, {
            type: 'pdf',
            pdfId: source.id,
            pageNumber,
          }),
        )
      }

      flushCurrentPage()
      const pristine =
        pagesRef.current.length === 1 &&
        pagesRef.current[0].strokes.length === 0 &&
        !pagesRef.current[0].background

      let target: number
      if (pristine) {
        pagesRef.current = imported
        target = 0
        const mode = paperModeForPages(imported)
        orientationRef.current = mode
        setOrientation(mode)
      } else {
        target = pagesRef.current.length
        pagesRef.current.push(...imported)
      }

      const page = pagesRef.current[target]
      engineRef.current?.loadStrokes(page.strokes, page.width, page.height)
      userZoomedRef.current = false
      setPageIndex(target)
      setDocName(name.replace(/\.pdf$/i, ''))
      setView('editor')
      setPageVersion((v) => v + 1)
      markDirty()
      refitSoon()
      showNotice(`已导入 ${imported.length} 页 PDF`)
    } catch (error) {
      console.error('PDF 导入失败', error)
      showNotice(`PDF 导入失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setImporting(false)
    }
  }

  async function openPdf() {
    const api = backend()
    if (!api) {
      fileInputRef.current?.click()
      return
    }

    try {
      const result = await api.openPdf()
      if (result) await importPdf(new Uint8Array(result.data), result.name)
    } catch (error) {
      console.error('打开 PDF 失败', error)
      showNotice('无法打开 PDF 文件')
    }
  }

  // ------------------------------------------------------------------ 翻页

  function goToPage(index: number, scrollTo = false) {
    if (index < 0 || index >= pagesRef.current.length) return

    if (scrollTo) {
      const scroll = scrollRef.current
      const item = pageLayoutRef.current.items[index]
      if (scroll && item) {
        scroll.scrollTop = Math.max(0, item.top - 24)
        scroll.scrollLeft = Math.max(0, item.left - 24)
      }
    }

    if (index === pageIndexRef.current) return
    flushCurrentPage()
    const page = pagesRef.current[index]
    engineRef.current?.loadStrokes(page.strokes, page.width, page.height)
    setPageIndex(index)
  }

  function addPage() {
    flushCurrentPage()
    pagesRef.current.push(createPageForMode(orientationRef.current))
    const index = pagesRef.current.length - 1
    const page = pagesRef.current[index]
    engineRef.current?.loadStrokes(page.strokes, page.width, page.height)
    setPageIndex(index)
    setPageVersion((v) => v + 1)
    markDirty()
    requestReveal(index, page.infinite)
  }

  function deletePage(index: number) {
    const pages = pagesRef.current
    if (pages.length <= 1) return

    flushCurrentPage()
    const current = pageIndexRef.current
    pages.splice(index, 1)

    let next = current
    if (index === current) next = Math.min(index, pages.length - 1)
    else if (index < current) next = current - 1

    const page = pages[next]
    engineRef.current?.loadStrokes(page.strokes, page.width, page.height)
    setPageIndex(next)
    setPageVersion((v) => v + 1)
    markDirty()
    requestReveal(next, page.infinite)
  }

  // ------------------------------------------------------------------ 快捷键

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('textarea, input, select, [contenteditable="true"]')) return

      if (viewRef.current === 'home') {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
          event.preventDefault()
          void openDocument()
        }
        return
      }

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase()
        if (key === 's') {
          event.preventDefault()
          void saveDocument(event.shiftKey)
          return
        }
        if (key === 'o') {
          event.preventDefault()
          void openDocument()
          return
        }
        if (key === 'n') {
          event.preventDefault()
          void newDocument()
          return
        }
        if (key === 'z') {
          event.preventDefault()
          engineRef.current?.undo()
          return
        }
        return
      }
      if (event.altKey) return

      const key = event.key.toLowerCase()
      if (key === 'p') setTool('pen')
      else if (key === 'b') setTool('ballpoint')
      else if (key === 'f') setTool('fountain')
      else if (key === 'h') setTool('highlighter')
      else if (key === 'e') setTool('eraser')
      else if (key === 's') setTool('select')
      else if (key === 'l') setTool('lasso')
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pageCount = pagesRef.current.length
  const currentPage = pagesRef.current[pageIndex] ?? pagesRef.current[0]
  const activeLayout = pageLayout.items[pageIndex] ?? pageLayout.items[0]
  const platform = backend()?.platform ?? 'browser'

  return (
    <div className={`app ${maximized ? 'maximized' : ''} platform-${platform}`}>
      <TitleBar
        mode={view}
        docName={docName}
        dirty={dirty}
        importing={importing}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onGoHome={goHome}
        onNewDocument={() => void newDocument()}
        onOpenDocument={() => void openDocument()}
        onSaveDocument={() => void saveDocument()}
        onOpenPdf={() => void openPdf()}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAppearance={() => setThemeOpen(true)}
        debug={debug}
        onToggleDebug={() => setDebug((v) => !v)}
      />

      <div className={`app-body ${view === 'home' ? 'is-hidden' : ''}`}>
        {sidebarOpen && !currentPage.infinite && (
          <PageSidebar
            pages={pagesRef.current}
            current={pageIndex}
            version={pageVersion}
            getPdf={getPdfForPage}
            onSelect={(index) => goToPage(index, true)}
            onAdd={addPage}
            onDelete={deletePage}
          />
        )}

        <main className="workspace" ref={workspaceRef}>
          <Toolbar
            tool={tool}
            onToolChange={setTool}
            styles={toolStyles}
            onStyleChange={(name, patch) =>
              setPrefs((prev) => ({
                ...prev,
                brushes: {
                  ...prev.brushes,
                  [name]: { ...prev.brushes[name], ...patch },
                },
              }))
            }
            eraserRadius={eraserRadius}
            onEraserRadiusChange={setEraserRadius}
            barrelEraser={barrelEraser}
            onBarrelEraserChange={setBarrelEraser}
            onUndo={() => engineRef.current?.undo()}
            onClear={() => engineRef.current?.clear()}
          />

          <div className="pages-scroll" ref={scrollRef} onScroll={handleScroll}>
            <div
              className="pages-stack"
              style={{ width: pageLayout.width, height: pageLayout.height }}
            >
              {pagesRef.current.map((page, index) => {
                const item = pageLayout.items[index]
                if (!item) return null
                return (
                  <div
                    key={page.id}
                    className={`page-sheet ${page.infinite ? 'infinite' : ''}`}
                    style={{
                      top: item.top,
                      left: item.left,
                      width: item.width,
                      height: item.height,
                    }}
                  >
                    {index !== pageIndex && (
                      <PagePreview
                        page={page}
                        pdf={getPdfForPage(page)}
                        zoom={zoom}
                        version={pageVersion}
                        scrollRoot={scrollRef}
                      />
                    )}
                  </div>
                )
              })}

              <div
                id="page"
                ref={pageRef}
                className={currentPage.infinite ? 'infinite' : ''}
                style={{
                  top: activeLayout.top,
                  left: activeLayout.left,
                  width: activeLayout.width,
                  height: activeLayout.height,
                }}
              >
                {currentPage.background?.type === 'pdf' && (
                  <PdfBackground
                    key={currentPage.id}
                    page={currentPage}
                    pdf={getPdfForPage(currentPage)}
                    zoom={zoom}
                  />
                )}
                <canvas ref={committedRef} />
                <canvas ref={liveRef} />
                <canvas ref={overlayRef} className="overlay" />
              </div>
            </div>
          </div>

          <div className="statusbar">
            {!currentPage.infinite && (
              <div className="page-nav">
                <button
                  disabled={pageIndex === 0}
                  title="上一页"
                  onClick={() => goToPage(pageIndex - 1, true)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {pageIndex + 1} / {pageCount}
                </span>
                <button
                  disabled={pageIndex >= pageCount - 1}
                  title="下一页"
                  onClick={() => goToPage(pageIndex + 1, true)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            <div className="zoom-controls">
              <button title="缩小" onClick={() => setManualZoom(zoom - 0.1)}>
                <ZoomOut size={14} />
              </button>
              <button
                className="zoom-value"
                title="Ctrl+滚轮缩放 · 点击适应工作区宽度"
                onClick={() => {
                  userZoomedRef.current = false
                  fitWorkspace()
                  requestReveal(
                    pageIndexRef.current,
                    pagesRef.current[pageIndexRef.current]?.infinite,
                  )
                }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button title="放大" onClick={() => setManualZoom(zoom + 0.1)}>
                <ZoomIn size={14} />
              </button>
            </div>
          </div>

          {debug && <Hud stats={stats} />}
          {notice && <div className="toast">{notice}</div>}
        </main>

        <AiPanel
          visible={aiOpen}
          settings={settings}
          attachments={attachments}
          onRemoveAttachment={(id) =>
            setAttachments((prev) => prev.filter((a) => a.id !== id))
          }
          onClearAttachments={() => setAttachments([])}
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={() => setAiOpen(false)}
        />
      </div>

      {view === 'home' && (
        <HomeScreen
          recents={prefs.recents}
          onCreate={(mode) => void newDocument(mode)}
          onOpenRecent={(path) => void openRecent(path)}
          onRemoveRecent={(path) =>
            setPrefs((prev) => ({ ...prev, recents: removeRecent(prev.recents, path) }))
          }
          onOpenFile={() => void openDocument()}
          onImportPdf={() => void openPdf()}
          onOpenTheme={() => setThemeOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void file.arrayBuffer().then((buffer) => importPdf(new Uint8Array(buffer), file.name))
          }
          event.target.value = ''
        }}
      />

      <input
        ref={documentInputRef}
        type="file"
        accept=".mnote,application/zip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void file.arrayBuffer().then(async (buffer) => {
              if (await confirmDiscardIfNeeded()) {
                await loadNotebook(new Uint8Array(buffer), null)
              }
            })
          }
          event.target.value = ''
        }}
      />

      {settingsOpen && (
        <SettingsDialog
          initial={settings}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {themeOpen && (
        <AppearanceDialog
          themeColor={prefs.themeColor}
          onChange={(color) => setPrefs((prev) => ({ ...prev, themeColor: color }))}
          onClose={() => setThemeOpen(false)}
        />
      )}

      {leaveOpen && (
        <LeaveDialog
          onSave={leaveAndSave}
          onDiscard={leaveAndDiscard}
          onCancel={() => setLeaveOpen(false)}
        />
      )}
    </div>
  )
}
