import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { PaperMode, PageData } from './notebook'
import { paperModeForPages } from './notebook'
import { loadPdf, type PdfSource } from './pdf'

const FORMAT_VERSION = 1
const DOCUMENT_ENTRY = 'doc.json'

interface PdfManifestEntry {
  id: string
  name: string
  entry: string
}

interface NotebookManifest {
  version: number
  name: string
  currentPage: number
  orientation?: PaperMode
  pages: PageData[]
  pdfs: PdfManifestEntry[]
}

export interface PackNotebookInput {
  name: string
  currentPage: number
  orientation: PaperMode
  pages: PageData[]
  pdfs: PdfSource[]
}

export interface UnpackedNotebook {
  name: string
  currentPage: number
  orientation: PaperMode
  pages: PageData[]
  pdfs: PdfSource[]
}

export function packNotebook(input: PackNotebookInput): Uint8Array {
  const manifest: NotebookManifest = {
    version: FORMAT_VERSION,
    name: input.name,
    currentPage: input.currentPage,
    orientation: input.orientation,
    pages: input.pages,
    pdfs: input.pdfs.map((pdf) => ({
      id: pdf.id,
      name: pdf.name,
      entry: `pdfs/${pdf.id}.pdf`,
    })),
  }

  const entries: Record<string, Uint8Array> = {
    [DOCUMENT_ENTRY]: strToU8(JSON.stringify(manifest)),
  }
  for (const pdf of input.pdfs) {
    entries[`pdfs/${pdf.id}.pdf`] = pdf.data
  }

  return zipSync(entries, { level: 6 })
}

export async function unpackNotebook(data: Uint8Array): Promise<UnpackedNotebook> {
  const entries = unzipSync(data)
  const manifestBytes = entries[DOCUMENT_ENTRY]
  if (!manifestBytes) throw new Error('文件里缺少 doc.json，不是有效的 MathNote 笔记')

  const manifest = JSON.parse(strFromU8(manifestBytes)) as NotebookManifest
  if (manifest.version !== FORMAT_VERSION) {
    throw new Error(`不支持的文档版本：${manifest.version}`)
  }
  if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) {
    throw new Error('文档没有页面')
  }

  const pages = manifest.pages.map((page, index) => {
    if (!Number.isFinite(page.width) || !Number.isFinite(page.height)) {
      throw new Error(`第 ${index + 1} 页尺寸无效`)
    }
    if (!Array.isArray(page.strokes)) {
      throw new Error(`第 ${index + 1} 页笔迹无效`)
    }
    return page
  })

  const pdfs: PdfSource[] = []
  for (const entry of manifest.pdfs ?? []) {
    const bytes = entries[entry.entry]
    if (!bytes) continue
    pdfs.push(await loadPdf(bytes, entry.name, entry.id))
  }

  return {
    name: manifest.name || '未命名笔记',
    currentPage: Math.min(Math.max(0, manifest.currentPage || 0), pages.length - 1),
    orientation:
      manifest.orientation === 'landscape' ||
      manifest.orientation === 'portrait' ||
      manifest.orientation === 'infinite'
        ? manifest.orientation
        : paperModeForPages(pages),
    pages,
    pdfs,
  }
}
