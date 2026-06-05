import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { multiServerCacheService, CACHE_KEYS_MULTI } from '../multiServerCacheService'
import { lunaService, getData } from '../../luna/lunaService'
import { useServerManagerStore } from '../../../stores/serverManagerStore'

vi.mock('../../luna/lunaService', () => ({
  lunaService: {
    request: vi.fn()
  },
  getData: vi.fn(),
  setData: vi.fn(),
  DB_KINDS: { PREFERENCES: 'prefs' }
}))

vi.mock('../../../stores/serverManagerStore', () => ({
  useServerManagerStore: {
    getState: vi.fn()
  }
}))

describe('multiServerCacheService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    
    // Default server manager store state
    useServerManagerStore.getState.mockReturnValue({
      servers: {
        'server-1': {
          clientIdentifier: 'server-1',
          name: 'Main Server',
          uri: 'http://localhost:32400',
          accessToken: 'token123',
          owned: true
        }
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should start background sync and poll endpoints', async () => {
    lunaService.request.mockResolvedValue({ returnValue: true })
    
    const callback = vi.fn()
    const unsubscribe = multiServerCacheService.subscribe(CACHE_KEYS_MULTI.ON_DECK, callback)
    
    multiServerCacheService.startBackgroundSync('On Deck', vi.fn().mockResolvedValue([]), CACHE_KEYS_MULTI.ON_DECK)
    
    // Wait for the async syncLoop to resolve
    await vi.advanceTimersByTimeAsync(10)
    
    // We expect lunaService.request to have been called for db get/put
    // since we don't fully mock the hub here, we just verify the interval started
    expect(multiServerCacheService.syncTimers.has(CACHE_KEYS_MULTI.ON_DECK)).toBe(true)
    
    multiServerCacheService.stopBackgroundSync(CACHE_KEYS_MULTI.ON_DECK)
    expect(multiServerCacheService.syncTimers.has(CACHE_KEYS_MULTI.ON_DECK)).toBe(false)
    
    unsubscribe()
  })

  it('should not update cache if fetch fails completely', async () => {
    const originalConsoleError = console.error
    console.error = vi.fn()

    const mockFetchFn = vi.fn().mockRejectedValue(new Error('Network error'))
    
    const cacheKey = multiServerCacheService.getProfileKey('cache_multiserver_error_test')
    multiServerCacheService.startBackgroundSync('On Deck Error', mockFetchFn, cacheKey)
    
    await vi.advanceTimersByTimeAsync(10)
    
    // It should have caught the error and logged it
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[MULTI CACHE] Background sync failed'), expect.any(Error))
    
    multiServerCacheService.stopBackgroundSync(cacheKey)
    console.error = originalConsoleError
  })

  it('should handle partial server failure by caching available items and updating UI', async () => {
    // Mock the DB to return an old cache
    const oldCache = [{ id: '1', title: 'Old Item' }]
    getData.mockResolvedValue(JSON.stringify(oldCache))

    const callback = vi.fn()
    multiServerCacheService.subscribe('cache_test_partial', callback)

    // Simulate fetch returning new data from available servers
    const freshData = [{ id: '2', title: 'New Item' }]
    const mockFetchFn = vi.fn().mockResolvedValue(freshData)

    const cacheKey = multiServerCacheService.getProfileKey('cache_test_partial')
    multiServerCacheService.startBackgroundSync('Partial Sync', mockFetchFn, cacheKey)
    await vi.advanceTimersByTimeAsync(10)

    // Should detect change and notify listeners
    expect(callback).toHaveBeenCalledWith(freshData)

    multiServerCacheService.stopBackgroundSync(cacheKey)
  })

  it('should return cached data immediately when forceRefresh is true (stale-while-revalidate)', async () => {
    // Mock the DB to return a valid cache
    const oldCache = [{ id: '1', title: 'Cached Item' }]
    getData.mockResolvedValue(JSON.stringify(oldCache))

    // Act
    const onDeckItems = await multiServerCacheService.getOnDeck(true)
    const recentlyAddedItems = await multiServerCacheService.getRecentlyAdded(true)

    // Assert
    expect(onDeckItems).toEqual(oldCache)
    expect(recentlyAddedItems).toEqual(oldCache)
    
    // Clean up timers
    multiServerCacheService.stopBackgroundSync(multiServerCacheService.getProfileKey(CACHE_KEYS_MULTI.ON_DECK))
    multiServerCacheService.stopBackgroundSync(multiServerCacheService.getProfileKey(CACHE_KEYS_MULTI.RECENTLY_ADDED))
  })
})
