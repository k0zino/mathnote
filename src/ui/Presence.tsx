import { useEffect, useRef, useState, type ReactNode } from 'react'

interface PresenceProps {
  open: boolean
  /** 退出动画时长，0 表示立即卸载 */
  duration?: number
  children: ReactNode
}

/**
 * 让条件渲染的浮层在关闭时先播放退出动画，再真正卸载。
 * 子节点仍按原来的 DOM 结构渲染，外层用 display: contents 避免影响布局。
 */
export function Presence({ open, duration = 180, children }: PresenceProps) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const wasOpen = useRef(open)

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      setMounted(true)
      setClosing(false)
      return
    }

    if (!wasOpen.current) return
    wasOpen.current = false

    if (duration <= 0) {
      setMounted(false)
      return
    }

    setClosing(true)
    const timer = window.setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, duration)
    return () => window.clearTimeout(timer)
  }, [open, duration])

  if (!mounted) return null

  return (
    <div className={`dialog-presence ${closing ? 'is-closing' : ''}`}>{children}</div>
  )
}
