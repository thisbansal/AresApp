import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // use relative paths
  plugins: [react()],
  build: {
    minify: false, // Disable minification for webOS
    target: 'es2015', // Use older JS target for better compatibility
  }
})
