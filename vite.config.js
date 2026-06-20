import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read package.json version
const pkgPath = path.resolve(__dirname, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

function syncVersionPlugin() {
  return {
    name: 'sync-version',
    buildStart() {
      try {
        const appInfoPath = path.resolve(__dirname, 'webos-meta/appinfo.json')
        if (fs.existsSync(appInfoPath)) {
          const appInfo = JSON.parse(fs.readFileSync(appInfoPath, 'utf-8'))
          if (appInfo.version !== pkg.version) {
            appInfo.version = pkg.version
            fs.writeFileSync(appInfoPath, JSON.stringify(appInfo, null, 2), 'utf-8')
            console.log(`[sync-version] Synced webos-meta/appinfo.json version to ${pkg.version}`)
          }
        }
      } catch (err) {
        console.error('[sync-version] Failed to sync version:', err)
      }
    }
  }
}

export default defineConfig({
  base: './', // use relative paths
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 53'], // WebOS 4 runs Chrome 53, ensuring polyfills for older TVs
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),
    syncVersionPlugin()
  ],
  build: {
    target: 'es2015', // Use older JS target for better compatibility
    rollupOptions: {
      // output: {
      //   manualChunks: {
      //     vendor: ['react', 'react-dom', 'react-router-dom', 'zustand']
      //   }
      // }
      // }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js']
  }
})
