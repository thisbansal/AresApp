/**
 * Initialization Service - Updated to use MediaDB for images
 */

import { universalStorage } from './UniversalStorage/universalStorage'
import { putImage, getImage } from './luna/mediaDBService'
import { getSetting, APP_KEYS } from './luna/settingsStorage'
import { getMainToken } from './luna/tokenStorage'
import { getLibraries, getLibraryItems } from './plex/plexContentService'
import { isWebOS } from './Environment/environment'
import { DB_KINDS } from './luna/lunaService'

const CACHE_KEYS = {
  LIBRARIES: 'init_libraries',
  LIBRARY_1_ITEMS: 'init_library_1_items',
  INIT_TIMESTAMP: 'init_timestamp',
  INIT_COMPLETE: 'init_complete',
}

class InitializationService {
  constructor() {
    this.initialized = false
    this.progress = 0
    this.status = 'Initializing...'
    this.useWebOS = isWebOS()
  }

  async initialize(onProgress = null) {
    try {
      this.updateProgress(0, 'Checking cache...', onProgress)

      const hasCache = await this.hasValidCache()

      if (hasCache) {
        this.updateProgress(10, 'Loading cached data...', onProgress)
        const cachedData = await this.loadCachedData()

        this.updateProgress(50, 'Verifying images...', onProgress)
        const allImagesCached = await this.verifyImageCache(cachedData.movies)

        if (allImagesCached) {
          this.updateProgress(100, 'Ready!', onProgress)
          this.initialized = true
          this.backgroundSync(onProgress)
          return cachedData
        }
      }

      return await this.fullInitialization(onProgress)

    } catch (err) {
      console.error('[Init] Initialization failed:', err)
      throw err
    }
  }

  async fullInitialization(onProgress) {
    this.updateProgress(10, 'Connecting to server...', onProgress)

    const serverUri = await getSetting(DB_KINDS.SERVER)
    const token = await getMainToken()

    if (!serverUri || !token) {
      throw new Error('Missing server or token')
    }

    this.updateProgress(20, 'Loading libraries...', onProgress)
    const libraries = await getLibraries(serverUri, token)

    this.updateProgress(30, 'Loading movies...', onProgress)
    const moviesResult = await getLibraryItems(serverUri, token, 1, {
      start: 0,
      size: 100
    })

    const movies = moviesResult.items || []

    this.updateProgress(40, 'Caching metadata...', onProgress)
    await universalStorage.set(CACHE_KEYS.LIBRARIES, JSON.stringify(libraries))
    await universalStorage.set(CACHE_KEYS.LIBRARY_1_ITEMS, JSON.stringify(moviesResult))

    // Download and cache images
    const visibleMovies = movies.slice(0, 24)
    const totalImages = visibleMovies.length

    this.updateProgress(50, `Downloading images (0/${totalImages})...`, onProgress)

    for (let i = 0; i < visibleMovies.length; i++) {
      const movie = visibleMovies[i]

      if (movie.thumb) {
        await this.downloadAndCacheImage(movie.thumb, movie.id)
      }

      const progress = 50 + Math.floor((i / totalImages) * 40)
      this.updateProgress(
        progress,
        `Downloading images (${i + 1}/${totalImages})...`,
        onProgress
      )
    }

    await universalStorage.set(CACHE_KEYS.INIT_COMPLETE, 'true')
    await universalStorage.set(CACHE_KEYS.INIT_TIMESTAMP, Date.now().toString())

    this.updateProgress(100, 'Ready!', onProgress)
    this.initialized = true

    return {
      libraries,
      movies,
    }
  }

  async downloadAndCacheImage(url, itemId) {
    try {
      console.log('[Init] 📥 Downloading image:', itemId)

      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const sizeKB = Math.round(blob.size / 1024)
      console.log('[Init] Downloaded', sizeKB, 'KB for item:', itemId)

      const base64 = await this.blobToBase64(blob)
      const dataUrl = `data:${blob.type};base64,${base64}`

      if (this.useWebOS) {
        // Use MediaDB on webOS
        console.log('[Init] Storing to MediaDB...')
        await putImage(itemId, dataUrl)
        console.log('[Init] ✓ Cached to MediaDB:', itemId)
      } else {
        // Use IndexedDB on browser
        console.log('[Init] Storing to IndexedDB...')
        await universalStorage.set(`image_${itemId}`, blob)
        console.log('[Init] ✓ Cached to IndexedDB:', itemId)
      }

    } catch (err) {
      console.error('[Init] ✗ Failed to cache image:', itemId, err)
    }
  }

  async loadCachedData() {
    const [librariesStr, moviesStr] = await Promise.all([
      universalStorage.get(CACHE_KEYS.LIBRARIES),
      universalStorage.get(CACHE_KEYS.LIBRARY_1_ITEMS),
    ])

    const libraries = librariesStr ? JSON.parse(librariesStr) : []
    const moviesResult = moviesStr ? JSON.parse(moviesStr) : { items: [] }

    return {
      libraries,
      movies: moviesResult.items || [],
    }
  }

  async hasValidCache() {
    const complete = await universalStorage.get(CACHE_KEYS.INIT_COMPLETE)
    const timestamp = await universalStorage.get(CACHE_KEYS.INIT_TIMESTAMP)

    if (!complete || !timestamp) return false

    const age = Date.now() - parseInt(timestamp)
    const maxAge = 24 * 60 * 60 * 1000

    return age < maxAge
  }

  async verifyImageCache(movies) {
    const visibleMovies = movies.slice(0, 24)

    for (const movie of visibleMovies) {
      const cached = await this.getCachedImage(movie.id)
      if (!cached) {
        console.log('[Init] Image not cached:', movie.id)
        return false
      }
    }

    return true
  }

  async getCachedImage(itemId) {
    console.log('[Init] 🔍 Looking for cached image:', itemId)

    if (this.useWebOS) {
      // Get from MediaDB
      const dataUrl = await getImage(itemId)
      if (dataUrl) {
        console.log('[Init] ✓ Found in MediaDB:', itemId)
        return dataUrl
      }
    } else {
      // Get from IndexedDB
      const blob = await universalStorage.get(`image_${itemId}`)
      if (blob) {
        console.log('[Init] ✓ Found in IndexedDB:', itemId)
        return URL.createObjectURL(blob)
      }
    }

    console.log('[Init] ✗ No cached image:', itemId)
    return null
  }

  async backgroundSync(onProgress) {
    setTimeout(async () => {
      try {
        console.log('[Init] Background sync started')

        const serverUri = await getSetting(DB_KINDS.SERVER)
        const token = await getMainToken()

        if (!serverUri || !token) return

        const freshMovies = await getLibraryItems(serverUri, token, 1, {
          start: 0,
          size: 100
        })

        const cachedMoviesStr = await universalStorage.get(CACHE_KEYS.LIBRARY_1_ITEMS)
        const cachedMovies = cachedMoviesStr ? JSON.parse(cachedMoviesStr) : { items: [] }

        if (this.hasDataChanged(cachedMovies.items, freshMovies.items)) {
          console.log('[Init] New content detected, updating cache')

          if (onProgress) {
            onProgress({ progress: 50, status: 'Updating cache...' })
          }

          await universalStorage.set(CACHE_KEYS.LIBRARY_1_ITEMS, JSON.stringify(freshMovies))

          const newMovies = this.getNewMovies(cachedMovies.items, freshMovies.items)
          for (const movie of newMovies) {
            if (movie.thumb) {
              await this.downloadAndCacheImage(movie.thumb, movie.id)
            }
          }

          if (onProgress) {
            onProgress({
              progress: 100,
              status: 'Updated!',
              dataUpdated: true,
              newData: freshMovies.items
            })
          }
        } else {
          console.log('[Init] No changes detected')
        }
      } catch (err) {
        console.error('[Init] Background sync failed:', err)
      }
    }, 2000)
  }

  hasDataChanged(oldItems, newItems) {
    if (!oldItems || !newItems) return true
    if (oldItems.length !== newItems.length) return true

    return oldItems[0]?.id !== newItems[0]?.id ||
           oldItems[0]?.updatedAt !== newItems[0]?.updatedAt
  }

  getNewMovies(oldItems, newItems) {
    const oldIds = new Set(oldItems.map(item => item.id))
    return newItems.filter(item => !oldIds.has(item.id))
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  updateProgress(progress, status, callback) {
    this.progress = progress
    this.status = status

    if (callback) {
      callback({ progress, status })
    }
  }

  async clearCache() {
    await universalStorage.delete(CACHE_KEYS.INIT_COMPLETE)
    await universalStorage.delete(CACHE_KEYS.INIT_TIMESTAMP)
    await universalStorage.delete(CACHE_KEYS.LIBRARIES)
    await universalStorage.delete(CACHE_KEYS.LIBRARY_1_ITEMS)

    console.log('[Init] Cache cleared')
    this.initialized = false
  }
}

export const initService = new InitializationService()

export const initializeApp = (onProgress) => {
  return initService.initialize(onProgress)
}

export const getCachedImage = (itemId) => {
  return initService.getCachedImage(itemId)
}

export const clearAppCache = () => {
  return initService.clearCache()
}