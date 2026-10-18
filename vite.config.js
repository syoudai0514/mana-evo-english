import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    // AudioWorklet は data: URL だと iPhone で読みこめないことがあるので、必ずファイルとして出す
    assetsInlineLimit: (file) => (file.endsWith('.worklet.js') ? false : undefined)
  }
})
