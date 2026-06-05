/**
 * Image Cache Service
 *
 * Downloads and stores images as base64 in webOS storage
 * for truly instant offline access
 */

import { universalStorage } from '../UniversalStorage/UniversalStorage'
import { putImage, getImage, clearAllImages } from '../luna/mediaDBService'
import { isWebOS } from '../Environment/environment'
import { PLEX_CONFIG } from '../../config/app'

const IMAGE_CACHE_PREFIX = 'img_cache_'
const IMAGE_INDEX_KEY = 'img_cache_index'

class ImageCacheService {
  constructor() {
    this.memoryCache = new Map() // In-memory cache for current session
    this.cacheIndex = null
    this.initPromise = null
  }

  /**
   * Initialize cache index
   */
  async init() {
    if (this.cacheIndex) return
    
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = (async () => {
      try {
        const indexStr = await universalStorage.get(IMAGE_INDEX_KEY, null)
        this.cacheIndex = indexStr ? JSON.parse(indexStr) : {}
        console.log('[ImageCache] Loaded index:', Object.keys(this.cacheIndex).length, 'images')
      } catch (err) {
        console.error('[ImageCache] Failed to load index:', err)
        this.cacheIndex = {}
      }
    })()
    
    return this.initPromise
  }

  /**
   * Auto-heal invalid data URIs (e.g. missing or generic MIME types from Plex)
   */
  _healDataUrl(dataUrl) {
    if (!dataUrl) return dataUrl;
    // If the data URI doesn't explicitly declare itself as an image, force it to image/jpeg
    if (dataUrl.startsWith('data:') && !dataUrl.startsWith('data:image/')) {
      return dataUrl.replace(/^data:[^;]*;base64,/, 'data:image/jpeg;base64,')
    }
    return dataUrl;
  }

  /**
   * Convert Data URL to Blob URL to bypass DOM size limits
   */
  dataUrlToBlobUrl(dataUrl) {
    try {
      if (!dataUrl.startsWith('data:')) return dataUrl;
      const parts = dataUrl.split(',')
      const mime = parts[0].match(/:(.*?);/)[1] || 'image/jpeg'
      const bstr = atob(parts[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      const blob = new Blob([u8arr], { type: mime })
      return URL.createObjectURL(blob)
    } catch (err) {
      console.error('[ImageCache] Failed to convert base64 to blob URL:', err)
      return dataUrl // Fallback to raw string
    }
  }

  /**
   * Get cached image URL (returns blob URL or downloads and caches)
   */
  async getCachedImage(url, itemId) {
    if (!url) return null

    if (PLEX_CONFIG.features?.enableImageCaching === false) {
      return url // Feature flag disabled: Bypass cache and return original network URL instantly
    }

    await this.init()

    // Check memory cache first
    if (this.memoryCache.has(url)) {
      console.log(`[ImageCache] Loaded from MEMORY cache: ${itemId}`)
      let memCached = this.memoryCache.get(url)
      
      // If it's still a data URL in memory (from old version), convert it
      if (memCached.startsWith('data:')) {
        const healed = this._healDataUrl(memCached)
        const blobUrl = this.dataUrlToBlobUrl(healed)
        this.memoryCache.set(url, blobUrl)
        return blobUrl
      }

      return memCached
    }

    // Check storage cache
    const cacheKey = this.getCacheKey(itemId)
    let cached = await this.getFromStorage(cacheKey)

    if (cached) {
      console.log(`[ImageCache] Loaded from STORAGE cache: ${itemId}`)
      
      const healed = this._healDataUrl(cached)
      if (healed !== cached) {
        cached = healed
        this.saveToStorage(itemId, cached, url)
      }

      // Convert massive Data URI to tiny Blob URL to prevent DOM crashes
      const blobUrl = this.dataUrlToBlobUrl(cached)

      // Store in memory for fast access
      this.memoryCache.set(url, blobUrl)
      return blobUrl
    }

    // Not cached - download and cache it
    console.log(`[ImageCache] Cache MISS, downloading from NETWORK: ${itemId}`)
    return await this.downloadAndCache(url, itemId)
  }

  /**
   * Download image and cache it
   */
  async downloadAndCache(url, itemId) {
    if (PLEX_CONFIG.features?.enableImageCaching === false) {
      return url // Feature flag disabled: Do not download or cache
    }

    try {
      console.log('[ImageCache] Downloading:', url)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob) // Tiny safe URL for the DOM

      // We still need to encode it to Base64 to save it into the Database
      const base64 = await this.blobToBase64(blob)
      const mimeType = blob.type || 'image/jpeg'
      const dataUrl = `data:${mimeType};base64,${base64}`

      // Store blob URL in fast memory cache
      this.memoryCache.set(url, blobUrl)

      // Store full string in webOS storage
      await this.saveToStorage(itemId, dataUrl, url)

      return blobUrl // Return the safe Blob URL to React
    } catch (err) {
      console.error('[ImageCache] Failed to download image:', err)
      
      // Fallback: If transcoder fails (e.g. 401 on shared servers), try the raw image URL
      if (url.includes('/photo/:/transcode')) {
        try {
          const urlObj = new URL(url)
          const innerUrlStr = urlObj.searchParams.get('url')
          if (innerUrlStr) {
            const innerUrl = decodeURIComponent(innerUrlStr)
            console.log('[ImageCache] Transcoder failed, falling back to raw image URL:', innerUrl)
            return await this.downloadAndCache(innerUrl, itemId)
          }
        } catch (fallbackErr) {
          console.error('[ImageCache] Fallback extraction failed:', fallbackErr)
        }
      }

      return url // Ultimate fallback to original URL
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
      if (isWebOS()) {
        await putImage(itemId, dataUrl)
      } else {
        const cacheKey = this.getCacheKey(itemId)
        await universalStorage.set(cacheKey, dataUrl)
      }

      // Always update our local memory index so we know we have it
      this.cacheIndex[itemId] = {
        url: originalUrl,
        cachedAt: Date.now()
      }
      await universalStorage.set(IMAGE_INDEX_KEY, JSON.stringify(this.cacheIndex))

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
      if (isWebOS()) {
        const itemId = cacheKey.replace(IMAGE_CACHE_PREFIX, '')
        return await getImage(itemId)
      } else {
        return await universalStorage.get(cacheKey, null)
      }
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

    if (isWebOS()) {
      // MediaDB handles large datasets well, no need to manually truncate 100 limit.
      // Doing this via Luna requests one-by-one is very slow anyway.
      return;
    }

    const entries = Object.entries(this.cacheIndex)
    if (entries.length <= 100) return

    // Sort by cached time
    entries.sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0))

    // Keep only first 100, delete the rest
    const toDelete = entries.slice(100)

    for (const [itemId, data] of toDelete) {
      const key = data.key || this.getCacheKey(itemId)
      await universalStorage.delete(key)
      delete this.cacheIndex[itemId]
    }

    await universalStorage.set(IMAGE_INDEX_KEY, JSON.stringify(this.cacheIndex))
    console.log('[ImageCache] Cleared', toDelete.length, 'old entries')
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    this.memoryCache.clear()
    this.cacheIndex = {}
    await universalStorage.delete(IMAGE_INDEX_KEY)
    
    if (isWebOS()) {
      await clearAllImages()
    }
    
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