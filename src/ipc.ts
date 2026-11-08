export interface AiSettings {
  presetId: string
  provider: 'openai' | 'anthropic'
  baseUrl: string
  model: string
  apiKey: string
}

export const DEFAULT_SETTINGS: AiSettings = {
  presetId: 'deepseek',
  provider: 'openai',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
}

export interface Attachment {
  id: string
  dataUrl: string
}

export interface ChatInputMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface ChatRequest {
  settings: AiSettings
  messages: ChatInputMessage[]
  system: string
  /** 会话级稳定 ID，OpenCode Go 通过 x-opencode-session 头做路由与缓存 */
  sessionId?: string
}

export interface ChatHandlers {
  onDelta?: (text: string) => void
  onDone?: () => void
  onError?: (message: string, aborted?: boolean) => void
}

export const SYSTEM_PROMPT = [
  '你是一位严谨、友善的数学助教，正在看用户手写笔记的截图。',
  '回答用简体中文，除非用户用其他语言提问。',
  '所有数学内容必须用 LaTeX：行内公式用 $...$，独立公式用 $$...$$。',
  '绝对不要使用 \\(...\\)、\\[...\\] 或 \\begin{equation} 作为公式定界符；不要用代码块包裹公式。',
  '推导要分步骤，每一步说明依据；不要跳步。',
  '如果截图里的手写内容看不清或有可能误读，先复述你的理解，再作答。',
  '如果用户要求只给提示，就不要直接给出完整答案。',
].join('\n')

export function backend() {
  return typeof window !== 'undefined' ? window.mathnote : undefined
}
