import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Same-origin /ws → gateway (avoids duplicate CORS on SockJS /info when dev server is on 5173)
      '/ws': {
        target: 'http://localhost:8089',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'sockjs-client': 'sockjs-client/dist/sockjs.min.js'
    }
  }
})