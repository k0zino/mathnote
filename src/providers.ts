import type { AiSettings } from './ipc'

export type ProviderProtocol = AiSettings['provider']
export type ProviderGroup = '推荐' | '国内' | '海外' | '本地 / 自定义'

export interface ProviderPreset {
  id: string
  label: string
  group: ProviderGroup
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  models: string[]
  /** 官方接口对图片输入的支持情况 */
  vision: 'yes' | 'maybe' | 'no'
  hint: string
}

export const PROVIDER_GROUPS: ProviderGroup[] = ['推荐', '国内', '海外', '本地 / 自定义']

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek（默认）',
    group: '推荐',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    vision: 'maybe',
    hint: 'DeepSeek 官方 API。文本推理很强，但 deepseek-chat / reasoner 不保证支持图片输入；发手写截图建议改用 OpenCode Go、通义、智谱或 OpenRouter 里的 VL 模型。',
  },
  {
    id: 'opencode-go',
    label: 'OpenCode Go',
    group: '推荐',
    protocol: 'openai',
    baseUrl: 'https://opencode.ai/inference/go/openai/v1',
    model: 'deepseek-v4.1-flash',
    models: [
      'deepseek-v4.1-flash',
      'deepseek-v4-pro',
      'kimi-k3',
      'kimi-k3.1-pro',
      'glm-5.3',
      'glm-5.3-flash',
      'qwen3.8-max',
      'qwen3.8-flash',
      'minimax-m3',
      'grok-4.7',
      'gpt-6-luna',
      'claude-haiku-5-5',
      'gemini-4-argon',
    ],
    vision: 'maybe',
    hint: 'OpenCode Go 订阅（$10/月起）的 OpenAI 兼容端点。客户端会自动附加 x-opencode-session 会话头和 User-Agent；Go 主要面向代码模型，图片输入不一定被支持。',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    group: '海外',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o'],
    vision: 'yes',
    hint: '官方 OpenAI API，图片输入支持完善。',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    group: '海外',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
    vision: 'yes',
    hint: 'Anthropic Messages API，原生支持图片。',
  },
  {
    id: 'kimi',
    label: 'Kimi（Moonshot）',
    group: '国内',
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
    group: '国内',
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
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-vl-plus',
    models: ['qwen3-vl-plus', 'qwen-vl-max', 'qwen-vl-plus'],
    vision: 'yes',
    hint: '阿里云 DashScope 的 OpenAI 兼容模式，选 qwen-vl / qwen3-vl 系列。',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-VL-72B-Instruct',
    models: [
      'Qwen/Qwen3-VL-32B-Instruct',
      'Qwen/Qwen2.5-VL-72B-Instruct',
      'deepseek-ai/DeepSeek-V3',
    ],
    vision: 'yes',
    hint: '聚合平台，模型名要带完整命名空间，例如 Qwen/Qwen2.5-VL-72B-Instruct。',
  },
  {
    id: 'volcengine',
    label: '火山方舟（豆包）',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1-6-vision-250815',
    models: ['doubao-seed-1-6-vision-250815', 'doubao-1.5-vision-pro-32k-250115'],
    vision: 'yes',
    hint: '火山引擎方舟。模型名请填控制台里的推理接入点 ID（ep-...）或完整模型 ID。',
  },
  {
    id: 'qianfan',
    label: '百度千帆（文心）',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    model: 'ernie-4.5-turbo-vl',
    models: ['ernie-4.5-turbo-vl', 'ernie-4.5-8k-preview'],
    vision: 'yes',
    hint: '百度智能云千帆 v2 的 OpenAI 兼容接口，选 VL 模型。',
  },
  {
    id: 'hunyuan',
    label: '腾讯混元',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    model: 'hunyuan-vision',
    models: ['hunyuan-vision', 'hunyuan-turbos-vision'],
    vision: 'yes',
    hint: '腾讯混元 OpenAI 兼容接口，选 vision 模型。',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://api.minimax.chat/v1',
    model: 'MiniMax-VL-01',
    models: ['MiniMax-VL-01', 'MiniMax-Text-01'],
    vision: 'yes',
    hint: 'MiniMax 开放平台，VL 模型支持图片输入。',
  },
  {
    id: 'stepfun',
    label: '阶跃星辰 StepFun',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://api.stepfun.com/v1',
    model: 'step-1o-vision-32k',
    models: ['step-1o-vision-32k', 'step-1v-8k'],
    vision: 'yes',
    hint: '阶跃星辰开放平台，选 vision 模型。',
  },
  {
    id: 'lingyi',
    label: '零一万物',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    model: 'yi-vision-v2',
    models: ['yi-vision-v2', 'yi-lightning'],
    vision: 'yes',
    hint: '零一万物开放平台，yi-vision 支持图片。',
  },
  {
    id: 'modelscope',
    label: '魔搭 ModelScope',
    group: '国内',
    protocol: 'openai',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    model: 'Qwen/Qwen3-VL-32B-Instruct',
    models: ['Qwen/Qwen3-VL-32B-Instruct', 'Qwen/Qwen2.5-VL-72B-Instruct'],
    vision: 'yes',
    hint: '魔搭社区推理 API，模型名带完整命名空间。',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    group: '海外',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash',
    models: [
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-5',
      'x-ai/grok-4.1-fast',
      'qwen/qwen2.5-vl-72b-instruct',
    ],
    vision: 'yes',
    hint: '一个 Key 访问多家模型，适合在 DeepSeek / Gemini / Claude 之间切换。会自动附加来源标识头。',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    group: '海外',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
    vision: 'yes',
    hint: 'Gemini 的 OpenAI 兼容端点。',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    group: '海外',
    protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4.1-fast',
    models: ['grok-4.1-fast', 'grok-4.1'],
    vision: 'yes',
    hint: 'xAI 官方 API，Grok 系列支持图片输入。',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    group: '海外',
    protocol: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'pixtral-large-latest',
    models: ['pixtral-large-latest', 'mistral-medium-latest'],
    vision: 'yes',
    hint: 'Mistral 官方 API，pixtral 系列支持图片。',
  },
  {
    id: 'groq',
    label: 'Groq',
    group: '海外',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    models: [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.3-70b-versatile',
    ],
    vision: 'yes',
    hint: 'Groq 的高速推理服务，Llama 4 Scout 支持图片。',
  },
  {
    id: 'together',
    label: 'Together AI',
    group: '海外',
    protocol: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'Qwen/Qwen2.5-VL-72B-Instruct',
    models: [
      'Qwen/Qwen2.5-VL-72B-Instruct',
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    ],
    vision: 'yes',
    hint: 'Together 推理平台，模型名带完整命名空间。',
  },
  {
    id: 'ollama',
    label: 'Ollama（本地）',
    group: '本地 / 自定义',
    protocol: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5vl:7b',
    models: ['qwen2.5vl:7b', 'llava:latest', 'minicpm-v:latest'],
    vision: 'yes',
    hint: '本地模型不需要 API Key；图片能力取决于你拉取的模型。',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio（本地）',
    group: '本地 / 自定义',
    protocol: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    model: 'qwen2.5-vl-7b-instruct',
    models: ['qwen2.5-vl-7b-instruct', 'llama-3.2-vision'],
    vision: 'yes',
    hint: 'LM Studio 的本地 OpenAI 兼容服务，不需要 API Key。',
  },
  {
    id: 'custom',
    label: '自定义 / 其他 OpenAI 兼容服务',
    group: '本地 / 自定义',
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
