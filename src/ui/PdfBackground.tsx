import { useEffect, useRef, useState } from 'react'
import type { PageData } from '../notebook'
import { renderPageRegion } from '../pageRender'
import type { PdfSource } from '../pdf'

interface PdfBackgroundProps {
  page: PageData
  pdf: PdfSource | undefined
  zoom: number
}

export function PdfBackground({ page, pdf, zoom }: PdfBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1)

  useEffect(() => {
    const update = () => setDpr(window.devicePixelRatio || 1)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    let cancelled = false

    const draw = async () => {
      const rendered = await renderPageRegion(
        page,
        pdf,
        { x: 0, y: 0, w: page.width, h: page.height },
        zoom * dpr,
        false,
      )
      const canvas = canvasRef.current
      if (cancelled || !canvas) return

      canvas.width = rendered.width
      canvas.height = rendered.height
      canvas.getContext('2d')?.drawImage(rendered, 0, 0)
    }

    draw().catch((error) => console.error('PDF 背景渲染失败', error))
    return () => {
      cancelled = true
    }
  }, [page, pdf, zoom, dpr])

  return <canvas ref={canvasRef} className="pdf-background" />
}
