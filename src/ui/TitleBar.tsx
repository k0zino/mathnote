import {
  Bug,
  FilePlus,
  FileText,
  FolderOpen,
  House,
  LoaderCircle,
  MessageSquare,
  NotebookPen,
  Palette,
  PanelLeft,
  Save,
  Settings,
} from 'lucide-react'

interface TitleBarProps {
  mode: 'home' | 'editor'
  docName: string
  dirty: boolean
  importing: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onGoHome: () => void
  onNewDocument: () => void
  onOpenDocument: () => void
  onSaveDocument: () => void
  onOpenPdf: () => void
  aiOpen: boolean
  onToggleAi: () => void
  onOpenSettings: () => void
  onOpenAppearance: () => void
  debug: boolean
  onToggleDebug: () => void
}

export function TitleBar(props: TitleBarProps) {
  const editor = props.mode === 'editor'

  return (
    <header className="titlebar">
      <div className="titlebar-inner">
        <div className="titlebar-left">
          {editor && (
            <>
              <button className="tb-icon" onClick={props.onGoHome} title="返回笔记库">
                <House size={16} />
              </button>
              <button
                className={`tb-icon ${props.sidebarOpen ? 'on' : ''}`}
                onClick={props.onToggleSidebar}
                title="页面侧栏"
              >
                <PanelLeft size={16} />
              </button>
            </>
          )}

          <div className="brand">
            <NotebookPen size={16} />
            <span>MathNote</span>
          </div>

          {editor ? (
            <>
              <button
                className="tb-icon"
                onClick={props.onNewDocument}
                title="新建笔记 (Ctrl+N)"
              >
                <FileText size={16} />
              </button>
              <button
                className="tb-icon"
                onClick={props.onOpenDocument}
                title="打开笔记 (Ctrl+O)"
              >
                <FolderOpen size={16} />
              </button>
              <button
                className="tb-icon"
                onClick={props.onSaveDocument}
                title="保存笔记 (Ctrl+S)"
              >
                <Save size={15} />
              </button>
              <button
                className="tb-icon"
                onClick={props.onOpenPdf}
                disabled={props.importing}
                title="导入 PDF 作业"
              >
                {props.importing ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <FilePlus size={16} />
                )}
              </button>
              <span className="doc-title">
                {props.docName}
                {props.dirty && <i className="dirty-dot" title="有未保存的修改" />}
              </span>
            </>
          ) : (
            <span className="home-label">笔记库</span>
          )}
        </div>

        <div className="titlebar-right">
          {editor && (
            <>
              <button
                className={`tb-icon ${props.debug ? 'on' : ''}`}
                onClick={props.onToggleDebug}
                title="调试信息（帧率 / 输入延迟 / 压感）"
              >
                <Bug size={16} />
              </button>
              <button
                className={`tb-icon ${props.aiOpen ? 'on' : ''}`}
                onClick={props.onToggleAi}
                title="AI 助手"
              >
                <MessageSquare size={16} />
              </button>
            </>
          )}
          <button className="tb-icon" onClick={props.onOpenAppearance} title="主题色">
            <Palette size={16} />
          </button>
          <button className="tb-icon" onClick={props.onOpenSettings} title="设置">
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
