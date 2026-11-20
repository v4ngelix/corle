import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// ELASA serves map images only with its own Referer. Browsers can't set it, so requests go through here.
// Dev/preview only; production needs the same route in the backend.
const proxy: Record<string, ProxyOptions> = {
  '/api/elasa/wms': {
    target: 'https://kaart.elasa.ee',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/elasa\/wms/, '/wms/elasa'),
    headers: { Referer: 'https://kaart.elasa.ee/' },
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
