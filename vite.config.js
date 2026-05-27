import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/pritonic-colors/',
  server: {
    open: true,
    port: 3000
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})