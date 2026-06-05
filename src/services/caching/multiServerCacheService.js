import { getData, setData, DB_KINDS } from '../luna/lunaService'
import { getMultiServerOnDeck, getMultiServerRecentlyAdded } from '../plex/multiServerContentHub'

const CACHE_KEYS = {
  ON_DECK: 'cache_multiserver_ondeck',
  RECENTLY_ADDED: 'cache_multiserver_recentlyadded',
  LAST_SYNC: 'cache_multiserver_lastsync_'
}

const SYNC_INTERVAL = 30000 // 30 seconds

class MultiServerCacheService {
  constructor() {
    this.syncTimers = new Map()
    this.listeners = new Map()
  }

  // Helper to deep compare metadata to prevent unnecessary React renders
  hasChanged(oldItems, newItems) {
    if (!oldItems || !newItems) return true
    if (oldItems.length !== newItems.length) return true
    if (oldItems.length === 0) return false

    // Quick check on first and last item
    const oldFirst = oldItems[0]
    const newFirst = newItems[0]
    
    // Check if the IDs changed or the view state changed
    return (
      oldFirst?.id !== newFirst?.id ||
      oldFirst?.viewOffset !== newFirst?.viewOffset ||
      oldFirst?.viewCount !== newFirst?.viewCount
    )
  }

  // Start background sync loop
  startBackgroundSync(type, fetchFn, cacheKey) {
    if (this.syncTimers.has(cacheKey)) return

    const syncLoop = async () => {
      try {
        console.log(`[MULTI CACHE] Background sync: ${type}...`)
        const freshData = await fetchFn()
        const cached = await this.getCached(cacheKey)

        if (!cached || this.hasChanged(cached, freshData)) {
          console.log(`[MULTI CACHE] ${type} changed, updating cache and UI`)
          await this.setCache(cacheKey, freshData)
          this.notifyListeners(cacheKey, freshData)
        } else {
          console.log(`[MULTI CACHE] ${type} unchanged`)
        }
      } catch (err) {
        console.error(`[MULTI CACHE] Background sync failed for ${type}:`, err)
      } finally {
        // Schedule next sync
        const timer = setTimeout(syncLoop, SYNC_INTERVAL)
        this.syncTimers.set(cacheKey, timer)
      }
    }

    // Run first sync immediately
    syncLoop()
  }

  stopBackgroundSync(cacheKey) {
    const timer = this.syncTimers.get(cacheKey)
    if (timer) {
      clearTimeout(timer)
      this.syncTimers.delete(cacheKey)
    }
  }

  async getOnDeck(forceRefresh = false) {
    const cacheKey = CACHE_KEYS.ON_DECK
    
    // Always start background sync when requested
    this.startBackgroundSync('On Deck', () => getMultiServerOnDeck(50), cacheKey)

    const cached = await this.getCached(cacheKey)
    if (cached) {
      console.log('[MULTI CACHE] Returning cached On Deck items:', cached.length)
      return cached
    }

    // If no cache, return empty array instantly while background sync fetches it
    // The UI will update as soon as the sync finishes via the listener
    return []
  }

  async getRecentlyAdded(forceRefresh = false) {
    const cacheKey = CACHE_KEYS.RECENTLY_ADDED
    
    this.startBackgroundSync('Recently Added', () => getMultiServerRecentlyAdded(50), cacheKey)

    const cached = await this.getCached(cacheKey)
    if (cached) {
      console.log('[MULTI CACHE] Returning cached Recently Added items:', cached.length)
      return cached
    }

    return []
  }

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

  notifyListeners(cacheKey, data) {
    const listeners = this.listeners.get(cacheKey)
    if (listeners) {
      listeners.forEach(callback => {
        try { callback(data) } catch (e) { console.error(e) }
      })
    }
  }

  async getCached(key) {
    try {
      const cached = await getData(DB_KINDS.PREFERENCES, key, null)
      return cached ? JSON.parse(cached) : null
    } catch (err) {
      console.error('[MULTI CACHE] Failed to get cache:', err)
      return null
    }
  }

  async setCache(key, data) {
    try {
      await setData(DB_KINDS.PREFERENCES, key, JSON.stringify(data))
    } catch (err) {
      console.error('[MULTI CACHE] Failed to set cache:', err)
    }
  }
}

export const multiServerCacheService = new MultiServerCacheService()
export const CACHE_KEYS_MULTI = CACHE_KEYS
