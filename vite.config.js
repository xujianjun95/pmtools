import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // QDII 订阅通知 API：本地开发转发到 qdii-notify 服务（生产由 nginx 反代）
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    /* motion/framer-motion 必须与宿主共用同一 React，否则会出现 useContext on null → 白屏（见 debug H4） */
    dedupe: ['react', 'react-dom'],
  },
})
