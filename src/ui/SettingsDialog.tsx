import { useState } from 'react'
import { X } from 'lucide-react'
import type { AiSettings } from '../ipc'
import {
  PROVIDERS,
  resolveProvider,
  settingsForProvider,
  visionLabel,
} from '../providers'

interface SettingsDialogProps {
  initial: AiSettings
  onSave: (settings: AiSettings) => void
  onClose: () => void
}

export function SettingsDialog({ initial, onSave, onClose }: SettingsDialogProps) {
  const [draft, setDraft] = useState<AiSettings>(() => {
    const preset = resolveProvider(initial)
    return { ...initial, presetId: preset.id }
  })

  const preset = resolveProvider(draft)
  const update = (patch: Partial<AiSettings>) => setDraft((prev) => ({ ...prev, ...patch }))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>AI 设置</h2>
          <button className="tb-icon" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>供应商</span>
            <select
              value={draft.presetId}
              onChange={(event) => {
                const next = PROVIDERS.find((item) => item.id === event.target.value)
                if (next) setDraft((prev) => settingsForProvider(next, prev))
              }}
            >
              {PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
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
              placeholder="https://api.openai.com/v1"
              spellCheck={false}
            />
          </label>

          <label className="field">
            <span>模型</span>
            <input
              value={draft.model}
              list="model-options"
              onChange={(event) => update({ model: event.target.value })}
              placeholder="gpt-4o"
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
              placeholder={preset.id === 'ollama' ? '本地服务可留空' : 'sk-...'}
              spellCheck={false}
            />
          </label>

          <div className={`vision-badge ${preset.vision}`}>{visionLabel(preset.vision)}</div>
          <p className="field-hint">{preset.hint}</p>
          <p className="field-hint">
            手写截图需要<strong>支持图片输入的多模态模型</strong>。
            密钥保存在本机用户目录，优先使用系统密钥链加密；所有 AI 请求由主进程发出。
          </p>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={() => onSave(draft)}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
