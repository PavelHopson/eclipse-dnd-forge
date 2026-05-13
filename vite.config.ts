import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
//
// `base` is read from BASE_URL env var so GitHub Pages deployment (which
// serves under /eclipse-dnd-forge/) can prefix assets correctly. Local
// dev (`npm run dev`) keeps the default `/`.
export default defineConfig({
  base: process.env.BASE_URL || '/',
  plugins: [react()],
  build: {
    sourcemap: false,
    outDir: 'build',
    minify: 'esbuild',
  }
})
