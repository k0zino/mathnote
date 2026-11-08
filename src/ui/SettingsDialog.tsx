import { useState } from 'react'
import { X } from 'lucide-react'
import type { AiSettings } from '../ipc'
import {
  PROVIDERS,
  PROVIDER_GROUPS,
  resolveProvider,
  settingsForProvider,
  visionLabel,
} from '../providers'

interface SettingsDialogProps {
  initial: AiSettings
  animations: boolean
  onSave: (settings: AiSettings, animations: boolean) => void
  onClose: () => void
}

export function SettingsDialog({
  initial,
  animations,
  onSave,
  onClose,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState<AiSettings>(() => {
    const preset = resolveProvider(initial)
    return { ...initial, presetId: preset.id }
  })
  const [animated, setAnimated] = useState(animations)

  const preset = resolveProvider(draft)
  const update = (patch: Partial<AiSettings>) => setDraft((prev) => ({ ...prev, ...patch }))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>设置</h2>
          <button className="tb-icon" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <div className="settings-section-title">界面</div>
            <div className="switch-field">
              <div>
                <span>界面动画</span>
                <p className="field-hint">
                  侧栏、AI 面板和对话框展开 / 收起时的过渡动画。关闭后立即切换，适合低配设备。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={animated}
                title={animated ? '关闭界面动画' : '开启界面动画'}
                className={`switch ${animated ? 'on' : ''}`}
                onClick={() => setAnimated((value) => !value)}
              >
                <span className="switch-thumb" />
              </button>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">AI 提供商</div>

            <label className="field">
              <span>供应商</span>
              <select
                value={draft.presetId}
                onChange={(event) => {
                  const next = PROVIDERS.find((item) => item.id === event.target.value)
                  if (!next) return
                  setDraft((prev) => ({
                    ...settingsForProvider(next, prev),
                    apiKey: next.id === prev.presetId ? prev.apiKey : '',
                  }))
                }}
              >
                {PROVIDER_GROUPS.map((group) => {
                  const items = PROVIDERS.filter((provider) => provider.group === group)
                  if (items.length === 0) return null
                  return (
                    <optgroup key={group} label={group}>
                      {items.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </label>

            <label className="field">
              <span>接口协议</span>
              <select
                value={draft.provider}
                onChange={(event) =>
                  update({ provider: event.target.value as AiSettings['provider'] })
                }
              >
                <option value="openai">OpenAI 兼容</option>
                <option value="anthropic">Anthropic Messages</option>
              </select>
            </label>

            <label className="field">
              <span>Base URL</span>
              <input
                value={draft.baseUrl}
                onChange={(event) => update({ baseUrl: event.target.value })}
                placeholder="https://api.deepseek.com/v1"
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>模型</span>
              <input
                value={draft.model}
                list="model-options"
                onChange={(event) => update({ model: event.target.value })}
                placeholder="deepseek-chat"
                spellCheck={false}
              />
              <datalist id="model-options">
                {preset.models.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span>API Key</span>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(event) => update({ apiKey: event.target.value })}
                placeholder={preset.id === 'ollama' || preset.id === 'lmstudio' ? '本地服务可留空' : 'sk-...'}
                spellCheck={false}
              />
            </label>

            <div className={`vision-badge ${preset.vision}`}>{visionLabel(preset.vision)}</div>
            <p className="field-hint">{preset.hint}</p>
            <p className="field-hint">
              手写截图需要<strong>支持图片输入的多模态模型</strong>。
              密钥保存在本机用户目录，优先使用系统密钥链加密；所有 AI 请求由主进程发出。
              {preset.id === 'opencode-go' && (
                <> OpenCode Go 的 <code>x-opencode-session</code> 头由应用自动发送。</>
              )}
            </p>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={() => onSave(draft, animated)}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
