import {
  FilePlus,
  FileText,
  FolderOpen,
  House,
  Infinity as InfinityIcon,
  Palette,
  Settings,
  Trash,
} from 'lucide-react'
import { useRef } from 'react'
import type { PaperMode } from '../notebook'
import { formatRelativeTime, type RecentDocument } from '../preferences'

interface HomeScreenProps {
  recents: RecentDocument[]
  onCreate: (orientation: PaperMode) => void
  onOpenRecent: (path: string) => void
  onRemoveRecent: (path: string) => void
  onOpenFile: () => void
  onImportPdf: () => void
  onOpenTheme: () => void
  onOpenSettings: () => void
}

function orientationLabel(orientation: PaperMode): string {
  if (orientation === 'infinite') return '无边'
  return orientation === 'landscape' ? '横版' : '竖版'
}

export function HomeScreen(props: HomeScreenProps) {
  const mainRef = useRef<HTMLElement>(null)

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="home">
      <aside className="home-nav">
        <div className="home-nav-label">文件</div>
        <button className="active" onClick={scrollToTop}>
          <House size={15} />
          开始
        </button>
        <button onClick={props.onOpenFile}>
          <FolderOpen size={15} />
          打开 .mnote
        </button>
        <button onClick={props.onImportPdf}>
          <FilePlus size={15} />
          导入 PDF
        </button>

        <div className="home-nav-spacer" />

        <button onClick={props.onOpenTheme}>
          <Palette size={15} />
          主题色
        </button>
        <button onClick={props.onOpenSettings}>
          <Settings size={15} />
          设置
        </button>
      </aside>

      <main className="home-main" ref={mainRef}>
        <div className="home-main-inner">
          <header className="home-title">
            <h1>新建</h1>
            <p>选择纸张类型开始书写，或从下面的最近文件继续。</p>
          </header>

          <div className="template-grid">
            <button
              className="template-card"
              onClick={() => props.onCreate('portrait')}
              title="新建竖版 A4"
            >
              <div className="template-paper portrait">
                <span />
              </div>
              <strong>空白竖版</strong>
              <small>A4 纵向 · 820 × 1160</small>
            </button>

            <button
              className="template-card"
              onClick={() => props.onCreate('landscape')}
              title="新建横版 A4"
            >
              <div className="template-paper landscape">
                <span />
              </div>
              <strong>空白横版</strong>
              <small>A4 横向 · 1160 × 820</small>
            </button>

            <button
              className="template-card"
              onClick={() => props.onCreate('infinite')}
              title="新建无边画布"
            >
              <div className="template-paper infinite">
                <InfinityIcon size={24} />
              </div>
              <strong>无边画布</strong>
              <small>大画布 · 可滚动书写</small>
            </button>
          </div>

          <section className="recent-section">
            <div className="recent-section-head">
              <h2>最近</h2>
              <span>{props.recents.length} 个文件</span>
            </div>

            <div className="recent-table">
              <div className="recent-header">
                <span />
                <span>名称</span>
                <span>页数</span>
                <span>方向</span>
                <span>最近修改</span>
                <span />
              </div>

              {props.recents.length > 0 ? (
                props.recents.map((recent) => (
                  <div
                    key={recent.path}
                    className="recent-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => props.onOpenRecent(recent.path)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        props.onOpenRecent(recent.path)
                      }
                    }}
                  >
                    <div className="recent-doc-icon">
                      <FileText size={15} />
                    </div>
                    <div className="recent-name">
                      <b title={recent.name}>{recent.name}</b>
                      <small title={recent.path}>{recent.path}</small>
                    </div>
                    <span className="recent-col">{recent.pageCount} 页</span>
                    <span className="recent-col">{orientationLabel(recent.orientation)}</span>
                    <span className="recent-col">{formatRelativeTime(recent.updatedAt)}</span>
                    <button
                      className="recent-remove"
                      title="从最近列表中移除"
                      onClick={(event) => {
                        event.stopPropagation()
                        props.onRemoveRecent(recent.path)
                      }}
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="recent-empty-row">
                  <FilePlus size={18} />
                  <span>还没有最近文件。新建一页，或打开已有的 `.mnote`。</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
