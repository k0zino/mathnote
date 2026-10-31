import { Plus, Trash } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { drawStrokesRegion } from '../ink/render'
import type { PageData } from '../notebook'
import { renderPageRegion } from '../pageRender'
import type { PdfSource } from '../pdf'

const THUMB_WIDTH = 128
const backgroundCache = new Map<string, HTMLCanvasElement>()

function cacheBackground(key: string, canvas: HTMLCanvasElement): void {
  if (backgroundCache.size > 200) {
    const oldest = backgroundCache.keys().next().value
    if (oldest) backgroundCache.delete(oldest)
  }
  backgroundCache.set(key, canvas)
}

interface ThumbnailProps {
  page: PageData
  pdf: PdfSource | undefined
  version: number
}

function Thumbnail({ page, pdf, version }: ThumbnailProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    const scale = THUMB_WIDTH / page.width
    const rect = { x: 0, y: 0, w: page.width, h: page.height }
    const key =
      page.background && pdf
        ? `${pdf.id}:${page.background.pageNumber}:${THUMB_WIDTH}`
        : `blank:${page.id}:${THUMB_WIDTH}`

    const draw = async () => {
      // PDF 背景按页缓存，写笔迹时只重画墨迹层
      let background = backgroundCache.get(key)
      if (!background) {
        background = await renderPageRegion(page, pdf, rect, scale, false)
        cacheBackground(key, background)
      }
      if (cancelled) return

      const canvas = ref.current
      if (!canvas) return
      canvas.width = background.width
      canvas.height = background.height

      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(background, 0, 0)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      drawStrokesRegion(context, page.strokes, rect)
    }

    draw().catch((error) => console.error('页面缩略图渲染失败', error))

    return () => {
      cancelled = true
    }
  }, [page, pdf, version])

  return <canvas ref={ref} className="thumb-canvas" />
}

interface PageSidebarProps {
  pages: PageData[]
  current: number
  version: number
  getPdf: (page: PageData) => PdfSource | undefined
  onSelect: (index: number) => void
  onAdd: () => void
  onDelete: (index: number) => void
}

export function PageSidebar(props: PageSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>页面</span>
        <span className="count">{props.pages.length}</span>
      </div>

      <div className="page-list">
        {props.pages.map((page, index) => (
          <div
            key={page.id}
            className={`page-item ${index === props.current ? 'active' : ''}`}
            onClick={() => props.onSelect(index)}
          >
            <Thumbnail page={page} pdf={props.getPdf(page)} version={props.version} />
            <div className="page-item-foot">
              <span>第 {index + 1} 页</span>
              {props.pages.length > 1 && (
                <button
                  className="page-delete"
                  title="删除本页"
                  onClick={(event) => {
                    event.stopPropagation()
                    props.onDelete(index)
                  }}
                >
                  <Trash size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="add-page" onClick={props.onAdd}>
        <Plus size={14} />
        新建页面
      </button>
    </aside>
  )
}
