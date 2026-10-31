import type { Stroke } from './ink/types'
import { PAGE_HEIGHT, PAGE_WIDTH } from './ink/engine'

export type Orientation = 'portrait' | 'landscape'
export type PaperMode = Orientation | 'infinite'

export const PAGE_SIZES: Record<Orientation, { width: number; height: number }> = {
  portrait: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
  landscape: { width: PAGE_HEIGHT, height: PAGE_WIDTH },
}

export const INFINITE_PAGE_SIZE = { width: 1800, height: 1200 }

export function pageSizeForOrientation(orientation: Orientation): {
  width: number
  height: number
} {
  return PAGE_SIZES[orientation]
}

export function pageSizeForMode(mode: PaperMode): { width: number; height: number } {
  return mode === 'infinite' ? INFINITE_PAGE_SIZE : PAGE_SIZES[mode]
}

export function orientationForPage(page: Pick<PageData, 'width' | 'height'>): Orientation {
  return page.width > page.height ? 'landscape' : 'portrait'
}

export function paperModeForPages(pages: readonly PageData[]): PaperMode {
  if (pages.some((page) => page.infinite)) return 'infinite'
  return pages.length > 0 ? orientationForPage(pages[0]) : 'portrait'
}

export interface PageBackground {
  type: 'pdf'
  pdfId: string
  /** PDF 页码，从 1 开始 */
  pageNumber: number
}

export interface PageData {
  id: string
  strokes: Stroke[]
  /** 文档坐标下的页面尺寸 */
  width: number
  height: number
  /** 无边笔记的大画布 */
  infinite?: boolean
  background?: PageBackground
}

export function createPage(
  width = PAGE_WIDTH,
  height = PAGE_HEIGHT,
  background?: PageBackground,
): PageData {
  return { id: crypto.randomUUID(), strokes: [], width, height, background }
}

export function createPageForMode(mode: PaperMode): PageData {
  const size = pageSizeForMode(mode)
  return {
    ...createPage(size.width, size.height),
    infinite: mode === 'infinite' || undefined,
  }
}

export function createPageForOrientation(orientation: Orientation): PageData {
  const size = pageSizeForOrientation(orientation)
  return createPage(size.width, size.height)
}
