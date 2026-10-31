import { Check, X } from 'lucide-react'

const THEME_COLORS = [
  '#3b64dc',
  '#2f8f5b',
  '#d1483b',
  '#b07cf0',
  '#e8a33d',
  '#0f9b8e',
  '#e35d6a',
  '#23262b',
]

interface AppearanceDialogProps {
  themeColor: string
  onChange: (color: string) => void
  onClose: () => void
}

export function AppearanceDialog({ themeColor, onChange, onClose }: AppearanceDialogProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal appearance-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>外观</h2>
          <button className="tb-icon" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <span>主题色</span>
            <div className="theme-grid">
              {THEME_COLORS.map((color) => (
                <button
                  key={color}
                  className={`theme-swatch ${themeColor === color ? 'active' : ''}`}
                  style={{ ['--theme' as string]: color }}
                  title={color}
                  onClick={() => onChange(color)}
                >
                  {themeColor === color && <Check size={13} />}
                </button>
              ))}
              <label className="theme-swatch custom" title="自定义主题色">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(event) => onChange(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="theme-preview">
            <div className="theme-preview-head">预览</div>
            <div className="theme-preview-row">
              <button className="btn primary">主按钮</button>
              <span className="theme-preview-link">链接 / 选中态</span>
            </div>
            <div className="theme-preview-pill">MathNote</div>
          </div>

          <p className="field-hint">
            主题色会应用到按钮、选中态、链接和 AI 面板强调色，并保存在本机。
          </p>
        </div>

        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
