import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import { PAGE_WIDTH } from './ink/engine'
import type { Rect } from './ink/types'

GlobalWorkerOptions.workerPort = new PdfWorker()

export interface PdfSource {
  id: string
  name: string
  document: PDFDocumentProxy
  /** 原始文件字节，保存 .mnote 时原样打包，不重压缩 */
  data: Uint8Array
}

export async function loadPdf(
  data: Uint8Array,
  name: string,
  id: string = crypto.randomUUID(),
): Promise<PdfSource> {
  // pdf.js 会把输入转移给 worker，必须保留一份独立副本用于保存
  const original = data.slice()
  const document = await getDocument({ data: original.slice() }).promise
  return { id, name, document, data: original }
}

export async function getPdfPageSize(
  document: PDFDocumentProxy,
  pageNumber: number,
  targetWidth = PAGE_WIDTH,
): Promise<{ width: number; height: number }> {
  const page = await document.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  return {
    width: targetWidth,
    height: (viewport.height / viewport.width) * targetWidth,
  }
}

/**
 * 把 PDF 页的指定文档区域画进已有 canvas。
 * canvas 由调用方按 rect * scale 设置好尺寸；PDF 变换与手写笔迹使用同一套文档坐标。
 */
export async function renderPdfRegion(
  source: PdfSource,
  pageNumber: number,
  documentWidth: number,
  rect: Rect,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const page = await source.document.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const pixelScale = (documentWidth / baseViewport.width) * scale
  const viewport = page.getViewport({ scale: pixelScale })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建 PDF 画布')

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: [1, 0, 0, 1, -rect.x * pixelScale, -rect.y * pixelScale],
    background: '#ffffff',
  }).promise
}
