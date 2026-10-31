import type { AiSettings } from './ipc'

export type ProviderProtocol = AiSettings['provider']

export interface ProviderPreset {
  id: string
  label: string
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  models: string[]
  /** 官方接口对图片输入的支持情况 */
  vision: 'yes' | 'maybe' | 'no'
  hint: string
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    vision: 'yes',
    hint: '官方 OpenAI API。',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
    vision: 'yes',
    hint: 'Anthropic Messages API，原生支持图片。',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    vision: 'maybe',
    hint: 'DeepSeek 官方 API 的图片支持随版本变化。如果发手写截图报错，请改用 OpenRouter / 硅基流动里的 VL 模型。',
  },
  {
    id: 'kimi',
    label: 'Kimi（Moonshot）',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-latest',
    models: ['kimi-latest', 'moonshot-v1-8k-vision-preview', 'moonshot-v1-32k-vision-preview'],
    vision: 'yes',
    hint: 'Kimi 的 vision 模型支持图片输入。',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.5v',
    models: ['glm-4.5v', 'glm-4v-plus', 'glm-4v-flash'],
    vision: 'yes',
    hint: '智谱开放平台，选带 V 的视觉模型。',
  },
  {
    id: 'qwen',
    label: '通义千问（DashScope）',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max',
    models: ['qwen-vl-max', 'qwen-vl-plus', 'qwen3-vl-plus'],
    vision: 'yes',
    hint: '阿里云 DashScope 的 OpenAI 兼容模式，选 qwen-vl 系列。',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-VL-72B-Instruct',
    models: [
      'Qwen/Qwen2.5-VL-72B-Instruct',
      'Qwen/Qwen3-VL-32B-Instruct',
      'deepseek-ai/DeepSeek-V3',
    ],
    vision: 'yes',
    hint: '聚合平台，模型名要带完整命名空间，例如 Qwen/Qwen2.5-VL-72B-Instruct。',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash',
    models: [
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
      'anthropic/claude-sonnet-4.5',
      'qwen/qwen2.5-vl-72b-instruct',
    ],
    vision: 'yes',
    hint: '一个 Key 访问多家模型，适合在 DeepSeek / Gemini / Claude 之间切换。',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    vision: 'yes',
    hint: 'Gemini 的 OpenAI 兼容端点。',
  },
  {
    id: 'ollama',
    label: 'Ollama（本地）',
    protocol: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5vl:7b',
    models: ['qwen2.5vl:7b', 'llava:latest', 'minicpm-v:latest'],
    vision: 'yes',
    hint: '本地模型不需要 API Key；图片能力取决于你拉取的模型。',
  },
  {
    id: 'custom',
    label: '自定义 / 其他 OpenAI 兼容服务',
    protocol: 'openai',
    baseUrl: '',
    model: '',
    models: [],
    vision: 'maybe',
    hint: '任何 OpenAI 兼容服务都可以：填 Base URL（通常以 /v1 结尾）和模型名。',
  },
]

const CUSTOM = PROVIDERS[PROVIDERS.length - 1]

export function getProvider(id: string | undefined): ProviderPreset {
  return PROVIDERS.find((provider) => provider.id === id) ?? CUSTOM
}

export function resolveProvider(
  settings: Pick<AiSettings, 'presetId' | 'provider' | 'baseUrl'>,
): ProviderPreset {
  const byId = PROVIDERS.find((provider) => provider.id === settings.presetId)
  if (byId && byId.id !== 'custom') return byId

  const normalized = settings.baseUrl.replace(/\/+$/, '')
  const byUrl = PROVIDERS.find(
    (provider) => provider.baseUrl && normalized.startsWith(provider.baseUrl.replace(/\/+$/, '')),
  )
  if (byUrl) return byUrl

  return CUSTOM
}

export function settingsForProvider(
  preset: ProviderPreset,
  current: AiSettings,
): AiSettings {
  return {
    ...current,
    presetId: preset.id,
    provider: preset.protocol,
    baseUrl: preset.baseUrl,
    model: preset.model,
  }
}

export function visionLabel(vision: ProviderPreset['vision']): string {
  if (vision === 'yes') return '支持图片输入'
  if (vision === 'no') return '不支持图片输入'
  return '图片支持不确定'
}
