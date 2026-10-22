import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // The isolated Three.js core is 746 KB minified but 191 KB gzip. Keep the
    // warning threshold just above that documented WebGL dependency chunk.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')
          if (normalizedId.includes('/node_modules/three/')) return 'three-core'
          if (/\/node_modules\/(?:@react-three|three-stdlib)\//.test(normalizedId)) return 'three-runtime'
          if (/\/node_modules\/(?:recharts|d3-[^/]+)\//.test(normalizedId)) return 'charts'
          if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(normalizedId)) return 'react-vendor'
        },
      },
    },
  },
})
