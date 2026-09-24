import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/gsap/')) return 'motion'
          if (id.includes('/react-router')) return 'router'
          return undefined
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8080', '/uploads': 'http://127.0.0.1:8080' },
  },
})
