import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8089';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      // Same-origin /ws → gateway (avoids duplicate CORS on SockJS /info when dev server is on 5173)
      '/ws': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // SockJS reconnects; avoid noisy ECONNRESET logs when backend restarts
          });
        },
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