import { defineConfig } from 'vite'

export default defineConfig({
  // 相对路径，保证生产模式下 file:// 加载正常
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
})
