/**
 * Image Cache Service
 *
 * Downloads and stores images as base64 in webOS storage
 * for truly instant offline access
 */

import { getConfig, setConfig } from '../luna/lunaService'

const IMAGE_CACHE_PREFIX = 'img_cache_'
const IMAGE_INDEX_KEY = 'img_cache_index'

class ImageCacheService {
  constructor() {
    this.memoryCache = new Map() // In-memory cache for current session
    this.cacheIndex = null
  }

  /**
   * Initialize cache index
   */
  async init() {
    if (this.cacheIndex) return

    try {
      const indexStr = await getConfig(IMAGE_INDEX_KEY, null)
      this.cacheIndex = indexStr ? JSON.parse(indexStr) : {}
      console.log('[ImageCache] Loaded index:', Object.keys(this.cacheIndex).length, 'images')
    } catch (err) {
      console.error('[ImageCache] Failed to load index:', err)
      this.cacheIndex = {}
    }
  }

  /**
   * Get cached image URL (returns base64 data URL or downloads and caches)
   */
  async getCachedImage(url, itemId) {
    if (!url) return null

    await this.init()

    // Check memory cache first
    if (this.memoryCache.has(url)) {
      return this.memoryCache.get(url)
    }

    // Check storage cache
    const cacheKey = this.getCacheKey(itemId)
    const cached = await this.getFromStorage(cacheKey)

    if (cached) {
      // Store in memory for fast access
      this.memoryCache.set(url, cached)
      return cached
    }

    // Not cached - download and cache it
    return await this.downloadAndCache(url, itemId)
  }

  /**
   * Download image and cache it
   */
  async downloadAndCache(url, itemId) {
    try {
      console.log('[ImageCache] Downloading:', url)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const blob = await response.blob()
      const base64 = await this.blobToBase64(blob)
      const dataUrl = `data:${blob.type};base64,${base64}`

      // Store in memory
      this.memoryCache.set(url, dataUrl)

      // Store in webOS storage
      await this.saveToStorage(itemId, dataUrl, url)

      return dataUrl
    } catch (err) {
      console.error('[ImageCache] Failed to download image:', err)
      return url // Fallback to original URL
    }
  }

  /**
   * Batch preload images in background
   */
  async preloadImages(items, maxImages = 24) {
    await this.init()

    const toPreload = items.slice(0, maxImages)
    console.log('[ImageCache] Preloading', toPreload.length, 'images in background')

    // Preload in background without blocking
    setTimeout(async () => {
      for (const item of toPreload) {
        if (item.thumb && item.id) {
          await this.getCachedImage(item.thumb, item.id)
          // Small delay to avoid overwhelming the server
          await this.sleep(100)
        }
      }
      console.log('[ImageCache] Preload complete')
    }, 1000)
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
   * Get cache key for an item
   */
  getCacheKey(itemId) {
    return `${IMAGE_CACHE_PREFIX}${itemId}`
  }

  /**
   * Save to storage
   */
  async saveToStorage(itemId, dataUrl, originalUrl) {
    try {
      const cacheKey = this.getCacheKey(itemId)

      // Save image data
      await setConfig(cacheKey, dataUrl)

      // Update index
      this.cacheIndex[itemId] = {
        key: cacheKey,
        url: originalUrl,
        cachedAt: Date.now()
      }

      await setConfig(IMAGE_INDEX_KEY, JSON.stringify(this.cacheIndex))

      console.log('[ImageCache] Saved:', itemId)
    } catch (err) {
      console.error('[ImageCache] Failed to save:', err)
    }
  }

  /**
   * Get from storage
   */
  async getFromStorage(cacheKey) {
    try {
      const dataUrl = await getConfig(cacheKey, null)
      return dataUrl
    } catch (err) {
      console.error('[ImageCache] Failed to get from storage:', err)
      return null
    }
  }

  /**
   * Clear old cache entries (keep last 100)
   */
  async clearOldCache() {
    await this.init()

    const entries = Object.entries(this.cacheIndex)
    if (entries.length <= 100) return

    // Sort by cached time
    entries.sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0))

    // Keep only first 100, delete the rest
    const toDelete = entries.slice(100)

    for (const [itemId, data] of toDelete) {
      await setConfig(data.key, null)
      delete this.cacheIndex[itemId]
    }

    await setConfig(IMAGE_INDEX_KEY, JSON.stringify(this.cacheIndex))
    console.log('[ImageCache] Cleared', toDelete.length, 'old entries')
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    this.memoryCache.clear()
    this.cacheIndex = {}
    await setConfig(IMAGE_INDEX_KEY, null)
    console.log('[ImageCache] Cleared all cache')
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton
export const imageCacheService = new ImageCacheService()

/**
 * Hook-style helper for React components
 */
export const useCachedImage = async (url, itemId) => {
  return await imageCacheService.getCachedImage(url, itemId)
}

/**
 * Batch preload helper
 */
export const preloadImages = (items, maxImages = 24) => {
  return imageCacheService.preloadImages(items, maxImages)
}