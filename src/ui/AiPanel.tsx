import {
  Check,
  CircleStop,
  Copy,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
  Settings2,
  Sparkles,
  Trash,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  backend,
  SYSTEM_PROMPT,
  type AiSettings,
  type Attachment,
  type ChatRequest,
} from '../ipc'
import { Markdown } from './Markdown'
import { resolveProvider } from '../providers'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

const PRESETS = [
  '检查我的推导，指出第一处错误',
  '只给提示，不要直接给答案',
  '把这段手写转成 LaTeX',
  '这一步为什么成立？',
]

interface AiPanelProps {
  visible: boolean
  settings: AiSettings
  attachments: Attachment[]
  onRemoveAttachment: (id: string) => void
  onClearAttachments: () => void
  onOpenSettings: () => void
  onClose: () => void
}

export function AiPanel(props: AiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const cancelRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => cancelRef.current?.(), [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function stop() {
    cancelRef.current?.()
    cancelRef.current = null
    setStreaming(false)
  }

  function clearChat() {
    stop()
    setMessages([])
  }

  function send(preset?: string) {
    const text = (preset ?? input).trim()
    if (streaming) return
    if (!text && props.attachments.length === 0) return

    const api = backend()
    if (!api) return

    const images = props.attachments.map((a) => a.dataUrl)
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      images,
    }
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    }
    const history = [...messages, userMessage]

    setMessages([...history, assistantMessage])
    setInput('')
    props.onClearAttachments()
    setStreaming(true)

    if (inputRef.current) inputRef.current.style.height = 'auto'

    const request: ChatRequest = {
      settings: props.settings,
      system: SYSTEM_PROMPT,
      messages: history.map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images,
      })),
    }

    cancelRef.current = api.chat(request, {
      onDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? { ...m, content: m.content + delta } : m,
          ),
        )
      },
      onDone: () => {
        cancelRef.current = null
        setStreaming(false)
      },
      onError: (message, aborted) => {
        cancelRef.current = null
        setStreaming(false)
        if (aborted) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: `${m.content}\n\n> 请求失败：${message}` }
              : m,
          ),
        )
      },
    })
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedId(message.id)
      window.setTimeout(() => setCopiedId(null), 1200)
    } catch {
      // 剪贴板不可用时忽略
    }
  }

  const canSend = !streaming && (input.trim().length > 0 || props.attachments.length > 0)
  const preset = resolveProvider(props.settings)

  return (
    <aside
      className={`ai-panel ${expanded ? 'expanded' : ''} ${props.visible ? '' : 'ai-panel-hidden'}`}
    >
      <div className="ai-head">
        <div className="ai-title">
          <Sparkles size={15} />
          <span>AI 助手</span>
        </div>
        <div className="ai-actions">
          <button
            title={expanded ? '还原' : '最大化'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button title="AI 设置" onClick={props.onOpenSettings}>
            <Settings2 size={15} />
          </button>
          <button title="清空对话" onClick={clearChat}>
            <Trash size={14} />
          </button>
          <button title="收起面板" onClick={props.onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="ai-model">
        <span className="model-name">{props.settings.model || '未配置模型'}</span>
        <span className="model-provider" title={preset.label}>
          {preset.label}
        </span>
      </div>

      <div className="ai-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ai-empty">
            <div className="ai-empty-icon">
              <MessageSquare size={22} />
            </div>
            <h3>圈出笔记，直接问</h3>
            <p>
              用工具栏的「框选」或「圈选」圈出题目或推导，选区会按高清分辨率重绘后自动附加到下方输入框。
            </p>
            <div className="presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setInput(preset)
                    inputRef.current?.focus()
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`msg ${message.role}`}>
              {message.images && message.images.length > 0 && (
                <div className="msg-images">
                  {message.images.map((src, index) => (
                    <img key={index} src={src} alt="选区" />
                  ))}
                </div>
              )}

              {message.role === 'user' ? (
                message.content && <div className="msg-text">{message.content}</div>
              ) : (
                <>
                  {message.content ? (
                    <Markdown>{message.content}</Markdown>
                  ) : (
                    <div className="typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {message.content && (
                    <button
                      className="msg-copy"
                      title="复制原文（含 LaTeX）"
                      onClick={() => copyMessage(message)}
                    >
                      {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === message.id ? '已复制' : '复制'}
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="composer">
        {props.attachments.length > 0 && (
          <div className="attachments">
            {props.attachments.map((attachment) => (
              <div className="attachment" key={attachment.id}>
                <img src={attachment.dataUrl} alt="选区附件" />
                <button
                  title="移除"
                  onClick={() => props.onRemoveAttachment(attachment.id)}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          placeholder="补充你的问题，例如：这一步为什么成立？"
          onChange={(event) => {
            setInput(event.target.value)
            event.target.style.height = 'auto'
            event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              send()
            }
          }}
        />

        <div className="composer-foot">
          <span className="hint">
            {backend() ? 'Enter 发送 · Shift+Enter 换行' : 'AI 需要在 Electron 中运行'}
          </span>
          {streaming ? (
            <button className="send stop" title="停止生成" onClick={stop}>
              <CircleStop size={16} />
            </button>
          ) : (
            <button
              className="send"
              title="发送"
              disabled={!canSend}
              onClick={() => send()}
            >
              <Send size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
