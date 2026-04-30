import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    /* motion/framer-motion 必须与宿主共用同一 React，否则会出现 useContext on null → 白屏（见 debug H4） */
    dedupe: ['react', 'react-dom'],
  },
})
