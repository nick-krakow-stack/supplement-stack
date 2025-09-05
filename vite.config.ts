import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [pages({
    entry: 'src/index_minimal.ts'
  })],
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: []
    }
  },
  define: {
    global: 'globalThis'
  }
})