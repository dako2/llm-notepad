import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-web'
  },
  server: {
    port: 3000
  },
  root: '.',
  publicDir: 'public'
})
