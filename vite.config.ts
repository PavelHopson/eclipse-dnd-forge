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
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          const moduleId = id.split('\\').join('/')

          if (!moduleId.includes('/node_modules/')) return undefined
          if (moduleId.includes('/openai/')) return 'ai-openai'
          if (moduleId.includes('/slate')) return 'editor'
          if (
            moduleId.includes('/@xyflow/') ||
            moduleId.includes('/react-d3-tree/') ||
            moduleId.includes('/d3-')
          ) {
            return 'graph'
          }
          if (moduleId.includes('/react-icons/')) return 'icons'
          return undefined
        },
      },
    },
  }
})
