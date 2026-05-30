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
    minify: false, // Disabled minification for insanely fast builds
    target: 'es2015', // Use older JS target for better compatibility
    rollupOptions: {
      // output: {
      //   manualChunks: {
      //     vendor: ['react', 'react-dom', 'react-router-dom', 'zustand']
      //   }
      // }
    }
  }
})
