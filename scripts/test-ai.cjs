const http = require('node:http')
const assert = require('node:assert')
const { streamChat } = require('../electron/ai.cjs')

let openaiBody = null
let anthropicBody = null

const server = http.createServer((request, response) => {
  let body = ''
  request.on('data', (chunk) => {
    body += chunk
  })
  request.on('end', () => {
    const payload = JSON.parse(body || '{}')

    if (request.url === '/v1/chat/completions') {
      openaiBody = payload
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write('data: {"choices":[{"delta":{"content":"$x^2$"}}]}\n\n')
      response.write('data: {"choices":[{"delta":{"content":" 的导数是 "}}]}\n\n')
      response.write('data: {"choices":[{"delta":{"content":"$2x$"}}]}\n\n')
      response.end('data: [DONE]\n\n')
      return
    }

    if (request.url === '/multiline/chat/completions') {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write('data: {"choices":[\n')
      response.write('data: {"delta":{"content":"多行"}}]}\n\n')
      response.end('data: {"choices":[{"delta":{"content":" 事件"}}]}')
      return
    }

    if (request.url === '/v1/messages') {
      anthropicBody = payload
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write(
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"$$2x$$"}}\n\n',
      )
      response.end()
      return
    }

    response.writeHead(404)
    response.end()
  })
})

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  const signal = new AbortController().signal
  const image = 'data:image/png;base64,AAAA'

  try {
    let openaiText = ''
    await streamChat(
      {
        settings: { provider: 'openai', baseUrl: `${base}/v1`, apiKey: 'key', model: 'mock' },
        system: '你是数学助教',
        messages: [{ role: 'user', content: '求导', images: [image] }],
      },
      { signal, onDelta: (text) => (openaiText += text) },
    )

    assert.strictEqual(openaiText, '$x^2$ 的导数是 $2x$')
    assert.strictEqual(openaiBody.model, 'mock')
    assert.strictEqual(openaiBody.stream, true)
    assert.strictEqual(openaiBody.messages[0].role, 'system')
    assert.ok(Array.isArray(openaiBody.messages[1].content))
    assert.strictEqual(openaiBody.messages[1].content[1].type, 'image_url')
    assert.strictEqual(openaiBody.messages[1].content[1].image_url.url, image)

    let multilineText = ''
    await streamChat(
      {
        settings: {
          provider: 'openai',
          baseUrl: `${base}/multiline`,
          apiKey: 'key',
          model: 'mock',
        },
        system: '你是数学助教',
        messages: [{ role: 'user', content: '测试多行 SSE' }],
      },
      { signal, onDelta: (text) => (multilineText += text) },
    )
    assert.strictEqual(multilineText, '多行 事件')

    let anthropicText = ''
    await streamChat(
      {
        settings: {
          provider: 'anthropic',
          baseUrl: base,
          apiKey: 'key',
          model: 'mock',
        },
        system: '你是数学助教',
        messages: [{ role: 'user', content: '求导', images: [image] }],
      },
      { signal, onDelta: (text) => (anthropicText += text) },
    )

    assert.strictEqual(anthropicText, '$$2x$$')
    assert.strictEqual(anthropicBody.system, '你是数学助教')
    assert.strictEqual(anthropicBody.messages[0].content[0].type, 'image')
    assert.strictEqual(anthropicBody.messages[0].content[0].source.data, 'AAAA')
    assert.strictEqual(anthropicBody.messages[0].content[1].type, 'text')

    console.log('AI stream tests passed')
    console.log('  openai    :', JSON.stringify(openaiText))
    console.log('  anthropic :', JSON.stringify(anthropicText))
  } catch (error) {
    console.error('AI stream tests failed')
    console.error(error)
    process.exitCode = 1
  } finally {
    server.close()
  }
})
