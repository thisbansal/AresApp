/**
 * Universal Storage Service
 *
 * Automatically uses:
 * - webOS storage APIs on TV (large quota)
 * - IndexedDB on desktop (gigabytes of storage)
 * - Falls back to localStorage if neither available
 */

import { isWebOS } from '../Environment/environment'

const DB_NAME = 'PlexAppDB'
const DB_VERSION = 1
const STORE_NAME = 'storage'

// Wait for webOS to be ready
const waitForWebOS = () => {
  return new Promise((resolve) => {
    if (webos) {
      console.log('[Storage] webOS already available')
      resolve(true)
      return
    }

    // Wait for webOSReady event
    const checkWebOS = () => {
      if (webos) {
        console.log('[Storage] webOS became available')
        document.removeEventListener('webOSReady', checkWebOS)
        resolve(true)
      }
    }

    document.addEventListener('webOSReady', checkWebOS)

    // Fallback timeout - if webOS doesn't load in 2 seconds, assume it's not available
    setTimeout(() => {
      if (!webos) {
        console.warn('[Storage] webOS not available after timeout, using browser storage')
        document.removeEventListener('webOSReady', checkWebOS)
        resolve(false)
      }
    }, 2000)
  })
}

// webOS storage functions (using LS2 API)
const webOSGet = async (key, defaultValue = null) => {
  if (!webos || !window?.webos?.service) {
    // Fallback to localStorage
    const value = localStorage.getItem(key)
    return value !== null ? value : defaultValue
  }

  return new Promise((resolve) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.systemservice', {
      method: 'getPreferences',
      parameters: {
        keys: [key]
      },
      onSuccess: (response) => {
        const value = response[key]
        resolve(value !== undefined ? value : defaultValue)
      },
      onFailure: (error) => {
        console.error('[Storage] webOS get failed:', error)
        // Fallback to localStorage
        const value = localStorage.getItem(key)
        resolve(value !== null ? value : defaultValue)
      }
    })
  })
}

const webOSSet = async (key, value) => {
  if (!webos || !window?.webos?.service) {
    // Fallback to localStorage
    localStorage.setItem(key, value)
    return
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.systemservice', {
      method: 'setPreferences',
      parameters: {
        [key]: value
      },
      onSuccess: () => {
        resolve()
      },
      onFailure: (error) => {
        console.error('[Storage] webOS set failed:', error)
        // Fallback to localStorage
        try {
          localStorage.setItem(key, value)
          resolve()
        } catch (err) {
          reject(err)
        }
      }
    })
  })
}

class UniversalStorage {
  constructor() {
    this.db = null
    this.initialized = false
    this.webOSAvailable = false
    this.shouldUseWebOS = isWebOS()
  }

  /**
   * Initialize storage
   */
  async init() {
    if (this.initialized) return

    if (this.shouldUseWebOS) {
      console.log('[Storage] Detected webOS TV, waiting for APIs to be ready...')
      this.webOSAvailable = await waitForWebOS()

      if (this.webOSAvailable) {
        console.log('[Storage] ✓ Using webOS storage APIs (native TV storage)')
        this.initialized = true
        return
      } else {
        console.warn('[Storage] ⚠️ webOS APIs not available, falling back to IndexedDB')
        this.shouldUseWebOS = false
      }
    }

    // Initialize IndexedDB for browser (or webOS fallback)
    try {
      console.log('[Storage] Initializing IndexedDB...')
      this.db = await this.openDatabase()
      console.log('[Storage] ✓ IndexedDB initialized successfully')
      this.initialized = true
    } catch (err) {
      console.error('[Storage] ✗ Failed to init IndexedDB:', err)
      console.warn('[Storage] ⚠️ Falling back to localStorage (limited quota)')
      this.initialized = true // Mark as initialized to use localStorage fallback
    }
  }

  /**
   * Open IndexedDB
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
    })
  }

  /**
   * Get value
   */
  async get(key, defaultValue = null) {
    await this.init()

    try {
      if (this.shouldUseWebOS && this.webOSAvailable) {
        const value = await webOSGet(key, defaultValue)
        if (value !== defaultValue) {
          console.log('[Storage] ✓ Retrieved from webOS:', key, '(size:', value?.length || 0, 'chars)')
        }
        return value
      }

      if (this.db) {
        const value = await this.getFromIndexedDB(key, defaultValue)
        if (value !== defaultValue) {
          console.log('[Storage] ✓ Retrieved from IndexedDB:', key)
        }
        return value
      }

      // Fallback to localStorage
      return this.getFromLocalStorage(key, defaultValue)
    } catch (err) {
      console.error('[Storage] ✗ Get failed:', key, err)
      return defaultValue
    }
  }

  /**
   * Set value
   */
  async set(key, value) {
    await this.init()

    try {
      if (this.shouldUseWebOS && this.webOSAvailable) {
        await webOSSet(key, value)
        console.log('[Storage] ✓ Saved to webOS:', key, '(size:', value?.length || 0, 'chars)')
        return
      }

      if (this.db) {
        await this.setToIndexedDB(key, value)
        console.log('[Storage] ✓ Saved to IndexedDB:', key)
        return
      }

      // Fallback to localStorage
      return this.setToLocalStorage(key, value)
    } catch (err) {
      console.error('[Storage] ✗ Set failed:', key, err)
      throw err
    }
  }

  /**
   * Delete value
   */
  async delete(key) {
    await this.init()

    try {
      if (this.shouldUseWebOS && this.webOSAvailable) {
        return await webOSSet(key, null)
      }

      if (this.db) {
        return await this.deleteFromIndexedDB(key)
      }

      localStorage.removeItem(key)
    } catch (err) {
      console.error('[Storage] ✗ Delete failed:', err)
    }
  }

  /**
   * Get from IndexedDB
   */
  getFromIndexedDB(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        resolve(result !== undefined ? result : defaultValue)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Set to IndexedDB
   */
  setToIndexedDB(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(value, key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Delete from IndexedDB
   */
  deleteFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get from localStorage (fallback)
   */
  getFromLocalStorage(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key)
      return value !== null ? value : defaultValue
    } catch (err) {
      console.error('[Storage] localStorage get failed:', err)
      return defaultValue
    }
  }

  /**
   * Set to localStorage (fallback)
   */
  setToLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        console.error('[Storage] localStorage quota exceeded')
        this.clearOldLocalStorage()
        localStorage.setItem(key, value)
      } else {
        throw err
      }
    }
  }

  /**
   * Clear old localStorage items
   */
  clearOldLocalStorage() {
    const keys = Object.keys(localStorage)
    const imageCacheKeys = keys.filter(k => k.startsWith('img_cache_') || k.startsWith('init_images_'))

    const toRemove = imageCacheKeys.slice(0, Math.floor(imageCacheKeys.length / 2))
    toRemove.forEach(key => localStorage.removeItem(key))

    console.log('[Storage] Cleared', toRemove.length, 'old localStorage items')
  }

  /**
   * Get all keys matching a prefix
   */
  async getAllKeys(prefix = '') {
    await this.init()

    if ((this.shouldUseWebOS && this.webOSAvailable) || !this.db) {
      const indexKey = '_all_keys_index'
      const index = await this.get(indexKey, '[]')
      const allKeys = JSON.parse(index)
      return prefix ? allKeys.filter(k => k.startsWith(prefix)) : allKeys
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAllKeys()

      request.onsuccess = () => {
        const keys = request.result
        resolve(prefix ? keys.filter(k => k.startsWith(prefix)) : keys)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear all data
   */
  async clear() {
    await this.init()

    if (this.shouldUseWebOS && this.webOSAvailable) {
      console.warn('[Storage] Cannot clear all webOS storage programmatically')
      return
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.clear()

        request.onsuccess = () => {
          console.log('[Storage] IndexedDB cleared')
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    }

    localStorage.clear()
    console.log('[Storage] localStorage cleared')
  }
}

// Export singleton
export const universalStorage = new UniversalStorage()

// Helper functions
export const getStorageValue = (key, defaultValue = null) => {
  return universalStorage.get(key, defaultValue)
}

export const setStorageValue = (key, value) => {
  return universalStorage.set(key, value)
}

export const deleteStorageValue = (key) => {
  return universalStorage.delete(key)
}

export const getAllStorageKeys = (prefix = '') => {
  return universalStorage.getAllKeys(prefix)
}

export const clearAllStorage = () => {
  return universalStorage.clear()
}