import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  base: './', // use relative paths
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 53'], // WebOS 4 runs Chrome 53, ensuring polyfills for older TVs
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        keep_fargs: true, // Don't drop unused function arguments
        drop_console: false, // Strip console logs for TV performance
      },
      mangle: {
        safari10: true, // Prevents bugs in older WebKit/Chromium engines
      }
    },
    target: 'es2015', // Use older JS target for better compatibility
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'] // Split framework code to parallelize parsing
        }
      }
    }
  }
})
