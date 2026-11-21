import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

const proxy: Record<string, ProxyOptions> = {
  '/api/elasa/wms': {
    target: 'https://kaart.elasa.ee',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/elasa\/wms/, '/wms/elasa'),
    headers: { Referer: 'https://kaart.elasa.ee/' },
  },
  '/api': { target: 'http://127.0.0.1:3000' },
  '/layers': { target: 'http://127.0.0.1:3000' },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
