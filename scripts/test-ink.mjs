import assert from 'node:assert/strict'
import { createServer } from 'vite'

function mockContext() {
  const calls = []
  return {
    calls,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo(...args) { calls.push(['moveTo', ...args]) },
    lineTo(...args) { calls.push(['lineTo', ...args]) },
    arc(...args) { calls.push(['arc', ...args]) },
    fill() { calls.push(['fill']) },
    fillRect(...args) { calls.push(['fillRect', ...args]) },
  }
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const { buildSamples, drawStroke, pressureToWidth, styleFor } = await server.ssrLoadModule(
    '/src/ink/render.ts',
  )
  const points = [
    { x: 0, y: 0, p: 0.1, t: 0 },
    { x: 20, y: 0, p: 1, t: 1 },
  ]

  const ballpointSamples = buildSamples(points, styleFor('ballpoint'))
  assert.ok(ballpointSamples.every((sample) => sample.w === 2))
  console.log('ok  ballpoint keeps a constant width')

  const fountain = styleFor('fountain')
  assert.ok(pressureToWidth(1, fountain) > pressureToWidth(0.1, fountain))
  console.log('ok  fountain pen responds to pressure')

  const highlighterSamples = buildSamples(points, styleFor('highlighter'))
  assert.ok(highlighterSamples.every((sample) => sample.w === 14))
  console.log('ok  highlighter keeps a constant width')

  const dot = mockContext()
  drawStroke(dot, {
    points: [{ x: 50, y: 50, p: 0.5, t: 0 }],
    color: '#ffff00',
    size: 1,
    tool: 'highlighter',
  })
  const rect = dot.calls.find((call) => call[0] === 'fillRect')
  assert.ok(rect)
  assert.ok(rect[4] > rect[3])
  assert.equal(dot.calls.filter((call) => call[0] === 'arc').length, 0)
  console.log('ok  highlighter dot is a vertical rectangle')

  const stroke = mockContext()
  drawStroke(stroke, { points, color: '#ffff00', size: 1, tool: 'highlighter' })
  assert.equal(stroke.calls.filter((call) => call[0] === 'arc').length, 0)
  console.log('ok  highlighter stroke has flat caps')

  console.log('Ink brush tests passed')
} finally {
  await server.close()
}
