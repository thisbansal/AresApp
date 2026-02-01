/**
 * Initialization Service
 *
 * Handles all heavy lifting BEFORE showing the UI:
 * 1. Load cached data (instant if available)
 * 2. Fetch fresh metadata from server
 * 3. Download and cache all visible images
 * 4. Only then show the UI
 *
 * Progress callbacks keep the splash screen updated
 */

import { universalStorage } from './UniversalStorage/UniversalStorage'
import { getSetting, APP_KEYS } from './luna/settingsStorage'
import { getMainToken } from './luna/tokenStorage'
import { getLibraries, getLibraryItems } from './plex/plexContentService'
import { isWebOS } from './Environment/environment'

const CACHE_KEYS = {
  LIBRARIES: 'init_libraries',
  LIBRARY_1_ITEMS: 'init_library_1_items',
  IMAGES_BLOB: 'init_images_blob_', // For IndexedDB
  IMAGES_BASE64: 'init_images_b64_', // For webOS
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

  /**
   * Main initialization flow
   */
  async initialize(onProgress = null) {
    try {
      this.updateProgress(0, 'Checking cache...', onProgress)

      // Check if we have cached data
      const hasCache = await this.hasValidCache()

      if (hasCache) {
        this.updateProgress(10, 'Loading cached data...', onProgress)
        const cachedData = await this.loadCachedData()

        this.updateProgress(50, 'Verifying images...', onProgress)
        const allImagesCached = await this.verifyImageCache(cachedData.movies)

        if (allImagesCached) {
          // Everything cached - instant load!
          this.updateProgress(100, 'Ready!', onProgress)
          this.initialized = true

          // Start background sync
          this.backgroundSync(onProgress)

          return cachedData
        }
      }

      // No cache or incomplete - do full initialization
      return await this.fullInitialization(onProgress)

    } catch (err) {
      console.error('[Init] Initialization failed:', err)
      throw err
    }
  }

  /**
   * Full initialization (first run or cache miss)
   */
  async fullInitialization(onProgress) {
    this.updateProgress(10, 'Connecting to server...', onProgress)

    const serverUri = await getSetting(APP_KEYS.PMS_SERVER)
    const token = await getMainToken()

    if (!serverUri || !token) {
      throw new Error('Missing server or token')
    }

    // Fetch metadata
    this.updateProgress(20, 'Loading libraries...', onProgress)
    const libraries = await getLibraries(serverUri, token)

    this.updateProgress(30, 'Loading movies...', onProgress)
    const moviesResult = await getLibraryItems(serverUri, token, 1, {
      start: 0,
      size: 100
    })

    const movies = moviesResult.items || []

    // Cache metadata
    this.updateProgress(40, 'Caching metadata...', onProgress)
    await universalStorage.set(CACHE_KEYS.LIBRARIES, JSON.stringify(libraries))
    await universalStorage.set(CACHE_KEYS.LIBRARY_1_ITEMS, JSON.stringify(moviesResult))

    // Download and cache images (first 24)
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

    // Mark as complete
    await universalStorage.set(CACHE_KEYS.INIT_COMPLETE, 'true')
    await universalStorage.set(CACHE_KEYS.INIT_TIMESTAMP, Date.now().toString())

    this.updateProgress(100, 'Ready!', onProgress)
    this.initialized = true

    return {
      libraries,
      movies,
    }
  }

  /**
   * Download and cache a single image
   */
  async downloadAndCacheImage(url, itemId) {
    try {
      console.log('[Init] 📥 Downloading image:', itemId, 'from', url)

      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const sizeKB = Math.round(blob.size / 1024)
      console.log('[Init] Downloaded', sizeKB, 'KB for item:', itemId)

      if (this.useWebOS) {
        console.log('[Init] Converting to base64 for webOS storage...')
        // For webOS: convert to base64 and store
        const base64 = await this.blobToBase64(blob)
        const dataUrl = `data:${blob.type};base64,${base64}`
        await universalStorage.set(`${CACHE_KEYS.IMAGES_BASE64}${itemId}`, dataUrl)
        console.log('[Init] ✓ Cached to webOS storage:', itemId, '(base64 size:', Math.round(dataUrl.length / 1024), 'KB)')
      } else {
        console.log('[Init] Storing blob to IndexedDB...')
        // For browser: store blob directly in IndexedDB
        await universalStorage.set(`${CACHE_KEYS.IMAGES_BLOB}${itemId}`, blob)
        console.log('[Init] ✓ Cached to IndexedDB:', itemId, '(blob size:', sizeKB, 'KB)')
      }

    } catch (err) {
      console.error('[Init] ✗ Failed to cache image:', itemId, err)
    }
  }

  /**
   * Load cached data
   */
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

  /**
   * Check if we have valid cache
   */
  async hasValidCache() {
    const complete = await universalStorage.get(CACHE_KEYS.INIT_COMPLETE)
    const timestamp = await universalStorage.get(CACHE_KEYS.INIT_TIMESTAMP)

    if (!complete || !timestamp) return false

    // Cache is valid for 24 hours
    const age = Date.now() - parseInt(timestamp)
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    return age < maxAge
  }

  /**
   * Verify that images are cached
   */
  async verifyImageCache(movies) {
    const visibleMovies = movies.slice(0, 24)

    for (const movie of visibleMovies) {
      const cacheKey = this.useWebOS
        ? `${CACHE_KEYS.IMAGES_BASE64}${movie.id}`
        : `${CACHE_KEYS.IMAGES_BLOB}${movie.id}`

      const cached = await universalStorage.get(cacheKey)
      if (!cached) {
        console.log('[Init] Image not cached:', movie.id)
        return false
      }
    }

    return true
  }

  /**
   * Get cached image
   */
  async getCachedImage(itemId) {
    const cacheKey = this.useWebOS
      ? `${CACHE_KEYS.IMAGES_BASE64}${itemId}`
      : `${CACHE_KEYS.IMAGES_BLOB}${itemId}`

    console.log('[Init] 🔍 Looking for cached image:', itemId, 'in', this.useWebOS ? 'webOS storage' : 'IndexedDB')

    const cached = await universalStorage.get(cacheKey)

    if (!cached) {
      console.log('[Init] ✗ No cached image found for:', itemId)
      return null
    }

    if (this.useWebOS) {
      console.log('[Init] ✓ Found cached base64 image for:', itemId, '(size:', Math.round(cached.length / 1024), 'KB)')
      // Already a data URL
      return cached
    } else {
      console.log('[Init] ✓ Found cached blob for:', itemId, '(size:', Math.round(cached.size / 1024), 'KB)')
      // Convert blob to object URL
      return URL.createObjectURL(cached)
    }
  }

  /**
   * Background sync (check for updates)
   */
  async backgroundSync(onProgress) {
    setTimeout(async () => {
      try {
        console.log('[Init] Background sync started')

        const serverUri = await getSetting(APP_KEYS.PMS_SERVER)
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

          // Cache new images
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
    }, 2000) // Start after 2 seconds
  }

  /**
   * Check if data changed
   */
  hasDataChanged(oldItems, newItems) {
    if (!oldItems || !newItems) return true
    if (oldItems.length !== newItems.length) return true

    return oldItems[0]?.id !== newItems[0]?.id ||
           oldItems[0]?.updatedAt !== newItems[0]?.updatedAt
  }

  /**
   * Get new movies
   */
  getNewMovies(oldItems, newItems) {
    const oldIds = new Set(oldItems.map(item => item.id))
    return newItems.filter(item => !oldIds.has(item.id))
  }

  /**
   * Convert blob to base64
   */
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

  /**
   * Update progress
   */
  updateProgress(progress, status, callback) {
    this.progress = progress
    this.status = status

    if (callback) {
      callback({ progress, status })
    }
  }

  /**
   * Clear cache
   */
  async clearCache() {
    await universalStorage.delete(CACHE_KEYS.INIT_COMPLETE)
    await universalStorage.delete(CACHE_KEYS.INIT_TIMESTAMP)
    await universalStorage.delete(CACHE_KEYS.LIBRARIES)
    await universalStorage.delete(CACHE_KEYS.LIBRARY_1_ITEMS)

    console.log('[Init] Cache cleared')
    this.initialized = false
  }
}

// Export singleton
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