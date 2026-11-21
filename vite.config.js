import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localFontStyles = {
  name: 'local-font-styles',
  apply: 'serve',
  configureServer(server) {
    // OSS only allows the production origins. Development uses the same font files locally.
    const stylesheet = readFileSync(new URL('./public/fonts/fonts.css', import.meta.url), 'utf8')
      .replaceAll('https://pmtools27.oss-cn-beijing.aliyuncs.com/fonts/', '/fonts/')

    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/fonts/fonts.css') return next()

      response.setHeader('Content-Type', 'text/css; charset=utf-8')
      response.setHeader('Cache-Control', 'no-cache')
      response.end(stylesheet)
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localFontStyles],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // QDII 订阅通知 API：本地开发转发到 qdii-notify 服务（生产由 nginx 反代）
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
      // 后台管理 API：本地开发转发到 admin-server 服务（生产由 nginx 反代）
      '/background-api': {
        target: 'http://127.0.0.1:3200',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    /* motion/framer-motion 必须与宿主共用同一 React，否则会出现 useContext on null → 白屏（见 debug H4） */
    dedupe: ['react', 'react-dom'],
  },
})
