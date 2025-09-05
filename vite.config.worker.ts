import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: '_worker'
    },
    outDir: 'dist',
    rollupOptions: {
      external: [],
      output: {
        entryFileNames: '_worker.js'
      }
    }
  },
  define: {
    global: 'globalThis'
  }
})