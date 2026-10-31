import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electronPath from 'electron'

const server = await createServer()
await server.listen()

const url = server.resolvedUrls?.local?.[0]
if (!url) {
  console.error('Vite dev server did not start')
  process.exit(1)
}

console.log(`[dev] renderer: ${url}`)

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})

child.on('close', async (code) => {
  await server.close()
  process.exit(code ?? 0)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal)
  })
}
