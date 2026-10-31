import { drawStrokesRegion } from './ink/render'
import type { Point, Rect } from './ink/types'
import type { PageData } from './notebook'
import { renderPdfRegion, type PdfSource } from './pdf'

function tracePolygon(context: CanvasRenderingContext2D, polygon: readonly Point[]): void {
  context.beginPath()
  context.moveTo(polygon[0].x, polygon[0].y)
  for (let i = 1; i < polygon.length; i++) {
    context.lineTo(polygon[i].x, polygon[i].y)
  }
  context.closePath()
}

/**
 * 页面区域统一渲染：先合成 PDF 背景，再叠加手写笔迹。
 * 屏幕背景、侧栏缩略图和发给 AI 的选区都走这条路径，避免只看到墨迹而丢了题干。
 * 套索选区会按多边形裁剪，矩形选区传 polygon = undefined。
 */
export async function renderPageRegion(
  page: PageData,
  pdf: PdfSource | undefined,
  rect: Rect,
  scale: number,
  includeStrokes = true,
  polygon?: readonly Point[],
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(rect.w * scale))
  canvas.height = Math.max(1, Math.ceil(rect.h * scale))

  const context = canvas.getContext('2d')
  if (!context) return canvas

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const clipped = polygon && polygon.length > 2

  if (page.background?.type === 'pdf' && pdf) {
    if (clipped) {
      const background = document.createElement('canvas')
      background.width = canvas.width
      background.height = canvas.height
      await renderPdfRegion(pdf, page.background.pageNumber, page.width, rect, scale, background)

      context.save()
      context.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale)
      tracePolygon(context, polygon)
      context.clip()
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.drawImage(background, 0, 0)
      context.restore()
    } else {
      await renderPdfRegion(pdf, page.background.pageNumber, page.width, rect, scale, canvas)
    }
  }

  if (includeStrokes) {
    context.save()
    context.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale)
    if (clipped) {
      tracePolygon(context, polygon)
      context.clip()
    }
    drawStrokesRegion(context, page.strokes, rect)
    context.restore()
  }

  return canvas
}
