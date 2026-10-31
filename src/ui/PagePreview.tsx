import { useEffect, useRef, useState } from 'react'
import type { PageData } from '../notebook'
import { renderPageRegion } from '../pageRender'
import type { PdfSource } from '../pdf'

interface PagePreviewProps {
  page: PageData
  pdf: PdfSource | undefined
  zoom: number
  version: number
  scrollRoot: { current: HTMLDivElement | null }
}

/**
 * 非活动页的静态预览。只渲染进入视口附近的一两页，离开后释放 canvas，
 * 避免把整本笔记都按屏幕分辨率栅格化。
 */
export function PagePreview({ page, pdf, zoom, version, scrollRoot }: PagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const root = scrollRoot.current
    if (!canvas || !root || page.infinite) return

    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { root, rootMargin: '320px 0px' },
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [page.infinite, scrollRoot])

  useEffect(() => {
    if (!visible || page.infinite) return
    let cancelled = false

    const dpr = window.devicePixelRatio || 1
    const scale = Math.min(2, Math.max(0.4, zoom * dpr))
    const rect = { x: 0, y: 0, w: page.width, h: page.height }

    renderPageRegion(page, pdf, rect, scale)
      .then((source) => {
        const canvas = canvasRef.current
        if (cancelled || !canvas) return
        canvas.width = source.width
        canvas.height = source.height
        canvas.getContext('2d')?.drawImage(source, 0, 0)
      })
      .catch((error) => console.error('页面预览渲染失败', error))

    return () => {
      cancelled = true
    }
  }, [visible, page, pdf, zoom, version])

  useEffect(() => {
    if (visible) return
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }, [visible])

  return <canvas ref={canvasRef} className="page-preview-canvas" />
}
