import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const binary = process.argv[2]
if (!binary) throw new Error('Usage: node cross_platform_test.mjs <ink_test binary>')
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const server = await createServer({
  root: projectRoot,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function typescriptCases(drawStroke) {
  const points = [
    { x: 20, y: 30, p: 0.05, t: 0 },
    { x: 80, y: 100, p: 0.4, t: 8 },
    { x: 160, y: 50, p: 1, t: 16 },
    { x: 220, y: 130, p: 0.65, t: 24 },
  ]
  const result = {}
  for (const tool of ['pen', 'ballpoint', 'fountain', 'highlighter']) {
    const commands = []
    const context = {
      save() {},
      restore() {},
      beginPath() {},
      moveTo(x, y) { commands.push([1, x, y]) },
      lineTo(x, y) { commands.push([2, x, y]) },
      closePath() { commands.push([3]) },
      arc(x, y, radius) { commands.push([4, x, y, radius]) },
      fillRect(x, y, width, height) { commands.push([5, x, y, width, height]) },
      fill() {},
    }
    drawStroke(context, { points, color: '#000000', size: 1, tool })
    result[tool] = commands
  }
  const dot = []
  const context = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {},
    fillRect(x, y, width, height) { dot.push([5, x, y, width, height]) },
  }
  drawStroke(context, {
    points: [{ x: 50, y: 50, p: 0.5, t: 0 }],
    color: '#000000', size: 1, tool: 'highlighter',
  })
  result.highlighter_dot = dot
  return result
}

function cppCases() {
  const output = execFileSync(binary, ['--dump'], { encoding: 'utf8' })
  const result = {}
  let current = null
  for (const line of output.trim().split('\n')) {
    if (line.startsWith('case ')) {
      current = line.slice(5)
      result[current] = []
    } else if (line === 'end') {
      current = null
    } else if (current) {
      result[current].push(line.split(' ').map(Number))
    }
  }
  return result
}

try {
  const { drawStroke } = await server.ssrLoadModule('/src/ink/render.ts')
  const expected = typescriptCases(drawStroke)
  const actual = cppCases()
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort())
  for (const name of Object.keys(expected)) {
    assert.equal(actual[name].length, expected[name].length, `${name}: command count`)
    for (let i = 0; i < expected[name].length; i++) {
      assert.equal(actual[name][i][0], expected[name][i][0], `${name}[${i}]: command type`)
      for (let j = 1; j < expected[name][i].length; j++) {
        assert.ok(
          Math.abs(actual[name][i][j] - expected[name][i][j]) < 1e-8,
          `${name}[${i}][${j}]: ${actual[name][i][j]} != ${expected[name][i][j]}`,
        )
      }
    }
    console.log(`ok  ${name} matches TypeScript geometry`)
  }
  console.log('Cross-platform ink geometry tests passed')
} finally {
  await server.close()
}
