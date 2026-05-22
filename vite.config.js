import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // use relative paths
  plugins: [react()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        keep_fargs: true, // Don't drop unused function arguments
      },
      mangle: {
        safari10: true, // Prevents bugs in older WebKit/Chromium engines
      }
    },
    target: 'es2015', // Use older JS target for better compatibility
  }
})
