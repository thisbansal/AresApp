/**
 * Media Cache Service with Image Preloading
 *
 * Not only caches metadata, but also preloads images into browser cache
 * so they display instantly on next launch
 */

import { getData, setData, DB_KINDS } from '../luna/lunaService'
import { getLibraries, getLibraryItems } from '../plex/plexContentService'

const CACHE_KEYS = {
  LIBRARIES: 'cache_libraries',
  LIBRARY_METADATA: 'cache_library_meta_',
  LAST_SYNC: 'cache_last_sync_',
  IMAGES_PRELOADED: 'cache_images_preloaded_',
}

const SYNC_INTERVAL = 30000

class MediaCacheService {
  constructor() {
    this.syncTimers = new Map()
    this.listeners = new Map()
    this.imageCache = new Map() // In-memory image cache
  }

  /**
   * Get libraries with cached data
   */
  async getLibraries(serverUri, token, forceRefresh = false) {
    // Make cache key unique per server to support multiple servers
    const safeUri = serverUri ? serverUri.replace(/[^a-zA-Z0-9]/g, '_') : 'default'
    const cacheKey = `${CACHE_KEYS.LIBRARIES}_${safeUri}`

    if (!forceRefresh) {
      const cached = await this.getCached(cacheKey)
      if (cached) {
        console.log(`[Cache] Returning cached libraries for ${serverUri}:`, cached.length)
        this.syncLibraries(serverUri, token, cacheKey)
        return cached
      }
    }

    console.log(`[Cache] No cached libraries for ${serverUri}, fetching from server...`)
    return await this.fetchAndCacheLibraries(serverUri, token, cacheKey)
  }

  /**
   * Get library items with image preloading
   */
  async getLibraryItems(serverUri, token, libraryId, options = {}, forceRefresh = false) {
    const safeUri = serverUri ? serverUri.replace(/[^a-zA-Z0-9]/g, '_') : 'default'
    const cacheKey = `${CACHE_KEYS.LIBRARY_METADATA}${safeUri}_${libraryId}`
    const { start = 0, size = 100 } = options

    if (!forceRefresh) {
      const cached = await this.getCached(cacheKey)
      if (cached && cached.items && cached.items.length > 0) {
        console.log(`[Cache] Returning cached library ${libraryId} for ${serverUri}:`, cached.items.length, 'items')

        // Preload images for instant display
        this.preloadImages(cached.items)

        // Start background sync
        this.syncLibraryItems(serverUri, token, libraryId, cacheKey, options)

        return cached
      }
    }

    console.log(`[Cache] No cached library ${libraryId} for ${serverUri}, fetching from server...`)
    const data = await this.fetchAndCacheLibraryItems(serverUri, token, libraryId, cacheKey, options)

    // Preload images after fetching
    this.preloadImages(data.items)

    return data
  }

  /**
   * Preload images into browser cache
   * This makes them appear instantly on next page load
   */
  preloadImages(items) {
    if (!items || items.length === 0) return

    const imagesToPreload = items.slice(0, 24) // Only preload first 24 (visible on screen)

    console.log(`[Cache] Preloading ${imagesToPreload.length} images`)

    imagesToPreload.forEach(item => {
      if (item.thumb && !this.imageCache.has(item.thumb)) {
        const img = new Image()
        img.src = item.thumb
        img.loading = 'eager' // Force eager loading
        img.decoding = 'async'

        img.onload = () => {
          this.imageCache.set(item.thumb, true)
        }

        img.onerror = () => {
          console.warn('[Cache] Failed to preload image:', item.thumb)
        }
      }
    })
  }

  /**
   * Background sync for libraries
   */
  async syncLibraries(serverUri, token, cacheKey) {
    if (this.syncTimers.has(cacheKey)) return

    const syncTimer = setTimeout(async () => {
      try {
        console.log('[Cache] Background sync: libraries')

        const freshData = await getLibraries(serverUri, token)

        const cached = await this.getCached(cacheKey)

        if (!cached || this.hasChanged(cached, freshData)) {
          console.log('[Cache] Libraries changed, updating cache')
          await this.setCache(cacheKey, freshData)
          this.notifyListeners(cacheKey, freshData)
        } else {
          console.log('[Cache] Libraries unchanged')
        }
      } catch (err) {
        console.error('[Cache] Background sync failed:', err)
      } finally {
        this.syncTimers.delete(cacheKey)
      }
    }, 1000)

    this.syncTimers.set(cacheKey, syncTimer)
  }

  /**
   * Background sync for library items
   */
  async syncLibraryItems(serverUri, token, libraryId, cacheKey, options) {
    if (this.syncTimers.has(cacheKey)) return

    const syncTimer = setTimeout(async () => {
      try {
        console.log(`[Cache] Background sync: library ${libraryId}`)

        const freshData = await getLibraryItems(serverUri, token, libraryId, options)

        const cached = await this.getCached(cacheKey)

        if (!cached || this.hasChanged(cached.items, freshData.items)) {
          console.log(`[Cache] Library ${libraryId} changed, updating cache`)
          await this.setCache(cacheKey, freshData)

          // Preload new images
          this.preloadImages(freshData.items)

          this.notifyListeners(cacheKey, freshData)
        } else {
          console.log(`[Cache] Library ${libraryId} unchanged`)
        }
      } catch (err) {
        console.error('[Cache] Background sync failed:', err)
      } finally {
        this.syncTimers.delete(cacheKey)
      }
    }, 1000)

    this.syncTimers.set(cacheKey, syncTimer)
  }

  /**
   * Fetch and cache libraries
   */
  async fetchAndCacheLibraries(serverUri, token, cacheKey) {
    const data = await getLibraries(serverUri, token)
    await this.setCache(cacheKey, data)
    await this.updateLastSync(cacheKey)
    return data
  }

  /**
   * Fetch and cache library items
   */
  async fetchAndCacheLibraryItems(serverUri, token, libraryId, cacheKey, options) {
    const data = await getLibraryItems(serverUri, token, libraryId, options)
    await this.setCache(cacheKey, data)
    await this.updateLastSync(cacheKey)
    return data
  }

  /**
   * Check if data has changed
   */
  hasChanged(oldData, newData) {
    if (!oldData || !newData) return true

    const oldLength = Array.isArray(oldData) ? oldData.length : oldData.items?.length || 0
    const newLength = Array.isArray(newData) ? newData.length : newData.items?.length || 0

    if (oldLength !== newLength) return true

    const oldItems = Array.isArray(oldData) ? oldData : oldData.items || []
    const newItems = Array.isArray(newData) ? newData : newData.items || []

    if (oldItems.length === 0 && newItems.length === 0) return false

    const oldFirst = oldItems[0]
    const newFirst = newItems[0]
    const oldLast = oldItems[oldItems.length - 1]
    const newLast = newItems[newItems.length - 1]

    return (
      oldFirst?.id !== newFirst?.id ||
      oldFirst?.updatedAt !== newFirst?.updatedAt ||
      oldLast?.id !== newLast?.id ||
      oldLast?.updatedAt !== newLast?.updatedAt
    )
  }

  /**
   * Subscribe to cache updates
   */
  subscribe(cacheKey, callback) {
    if (!this.listeners.has(cacheKey)) {
      this.listeners.set(cacheKey, new Set())
    }
    this.listeners.get(cacheKey).add(callback)

    return () => {
      const listeners = this.listeners.get(cacheKey)
      if (listeners) {
        listeners.delete(callback)
      }
    }
  }

  /**
   * Notify listeners of cache updates
   */
  notifyListeners(cacheKey, data) {
    const listeners = this.listeners.get(cacheKey)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (err) {
          console.error('[Cache] Listener error:', err)
        }
      })
    }
  }

  /**
   * Get cached data
   */
  async getCached(key) {
    try {
      const cached = await getData(DB_KINDS.PREFERENCES, key, null)
      if (!cached) return null

      const data = JSON.parse(cached)
      return data
    } catch (err) {
      console.error('[Cache] Failed to get cached data:', err)
      return null
    }
  }

  /**
   * Set cache data
   */
  async setCache(key, data) {
    try {
      await setData(DB_KINDS.PREFERENCES, key, JSON.stringify(data))
    } catch (err) {
      console.error('[Cache] Failed to set cache:', err)
    }
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(key) {
    const syncKey = `${CACHE_KEYS.LAST_SYNC}${key}`
    await setData(DB_KINDS.PREFERENCES, syncKey, Date.now().toString())
  }

  /**
   * Get last sync timestamp
   */
  async getLastSync(key) {
    const syncKey = `${CACHE_KEYS.LAST_SYNC}${key}`
    const timestamp = await getData(DB_KINDS.PREFERENCES, syncKey, null)
    return timestamp ? parseInt(timestamp) : null
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    console.log('[Cache] Clearing all cache')
    this.imageCache.clear()
  }

  /**
   * Clear specific cache
   */
  async clearCacheForKey(key) {
    await setData(DB_KINDS.PREFERENCES, key, null)
    await setData(DB_KINDS.PREFERENCES, `${CACHE_KEYS.LAST_SYNC}${key}`, null)
  }

  /**
   * Cleanup timers
   */
  cleanup() {
    this.syncTimers.forEach(timer => clearTimeout(timer))
    this.syncTimers.clear()
    this.listeners.clear()
    this.imageCache.clear()
  }
}

// Export singleton instance
export const mediaCacheService = new MediaCacheService()

// Helper functions for UI components
export const getLibrariesCached = (serverUri, token, forceRefresh = false) => {
  return mediaCacheService.getLibraries(serverUri, token, forceRefresh)
}

export const getLibraryItemsCached = (serverUri, token, libraryId, options = {}, forceRefresh = false) => {
  return mediaCacheService.getLibraryItems(serverUri, token, libraryId, options, forceRefresh)
}

export const subscribeToCacheUpdates = (cacheKey, callback) => {
  return mediaCacheService.subscribe(cacheKey, callback)
}

export const clearMediaCache = () => {
  return mediaCacheService.clearCache()
}