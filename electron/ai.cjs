/**
 * AI provider 适配。放在主进程：密钥不进渲染进程、不受 CORS 限制、流式好控制。
 * 目前支持 OpenAI 兼容协议（覆盖绝大多数云端和本地服务）与 Anthropic Messages。
 */

function toOpenAIMessages(messages, system) {
  const out = []
  if (system) out.push({ role: 'system', content: system })

  for (const m of messages) {
    const images = m.images || []
    if (m.role === 'user' && images.length > 0) {
      out.push({
        role: 'user',
        content: [
          { type: 'text', text: m.content || '请看这张图。' },
          ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      })
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

function toAnthropicMessages(messages) {
  return messages.map((m) => {
    const images = m.images || []
    if (m.role === 'user' && images.length > 0) {
      return {
        role: 'user',
        content: [
          ...images.map((url) => ({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: String(url).replace(/^data:image\/png;base64,/, ''),
            },
          })),
          { type: 'text', text: m.content || '请看这张图。' },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })
}

async function readSSE(response, onEvent) {
  if (!response.body) throw new Error('响应没有数据流')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (event) => {
    const data = event
      .split(/\r\n|\r|\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    if (!data) return true
    if (data === '[DONE]') return false

    let parsed
    try {
      parsed = JSON.parse(data)
    } catch {
      return true
    }
    onEvent(parsed)
    return true
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let separator = buffer.match(/(?:\r\n|\r|\n){2}/)
    while (separator?.index !== undefined) {
      const event = buffer.slice(0, separator.index)
      buffer = buffer.slice(separator.index + separator[0].length)
      if (!dispatch(event)) return
      separator = buffer.match(/(?:\r\n|\r|\n){2}/)
    }
  }

  buffer += decoder.decode()
  dispatch(buffer)
}

async function checkResponse(response) {
  if (response.ok) return
  const text = await response.text().catch(() => '')
  throw new Error(`HTTP ${response.status} ${response.statusText}\n${text.slice(0, 800)}`)
}

async function streamChat(request, { signal, onDelta }) {
  const { settings, messages, system } = request
  const baseUrl = String(settings.baseUrl || '').replace(/\/+$/, '')
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(baseUrl)

  if (!settings.apiKey && !local) throw new Error('还没有配置 API Key，点右上角设置填写。')
  if (!baseUrl) throw new Error('还没有配置 Base URL。')
  if (!settings.model) throw new Error('还没有配置模型名。')

  if (settings.provider === 'anthropic') {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        ...(settings.apiKey ? { 'x-api-key': settings.apiKey } : {}),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        stream: true,
        system,
        messages: toAnthropicMessages(messages),
      }),
    })
    await checkResponse(response)

    await readSSE(response, (event) => {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        onDelta(event.delta.text)
      }
      if (event.type === 'error') {
        throw new Error(event.error?.message || 'Anthropic 返回错误')
      }
    })
    return
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: toOpenAIMessages(messages, system),
    }),
  })
  await checkResponse(response)

  await readSSE(response, (event) => {
    const delta = event.choices?.[0]?.delta?.content
    if (typeof delta === 'string') onDelta(delta)
  })
}

module.exports = { streamChat }
