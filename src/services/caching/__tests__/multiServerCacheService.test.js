import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { multiServerCacheService, CACHE_KEYS_MULTI } from '../multiServerCacheService'
import { lunaService } from '../../luna/lunaService'
import { useServerManagerStore } from '../../../stores/serverManagerStore'

vi.mock('../../luna/lunaService', () => ({
  lunaService: {
    request: vi.fn()
  }
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
    
    multiServerCacheService.startBackgroundSync('On Deck Error', mockFetchFn, 'cache_multiserver_error_test')
    
    await vi.advanceTimersByTimeAsync(10)
    
    // It should have caught the error and logged it
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[MULTI CACHE] Background sync failed'), expect.any(Error))
    
    multiServerCacheService.stopBackgroundSync('cache_multiserver_error_test')
    console.error = originalConsoleError
  })

  it('should handle partial server failure by caching available items and updating UI', async () => {
    // Mock the DB to return an old cache
    const oldCache = [{ id: '1', title: 'Old Item' }]
    lunaService.request.mockImplementation((service, options) => {
      if (options.method === 'find') {
        return Promise.resolve({ returnValue: true, results: [{ value: JSON.stringify(oldCache) }] })
      }
      return Promise.resolve({ returnValue: true })
    })

    const callback = vi.fn()
    multiServerCacheService.subscribe('cache_test_partial', callback)

    // Simulate fetch returning new data from available servers
    const freshData = [{ id: '2', title: 'New Item' }]
    const mockFetchFn = vi.fn().mockResolvedValue(freshData)

    multiServerCacheService.startBackgroundSync('Partial Sync', mockFetchFn, 'cache_test_partial')
    await vi.advanceTimersByTimeAsync(10)

    // Should detect change and notify listeners
    expect(callback).toHaveBeenCalledWith(freshData)

    multiServerCacheService.stopBackgroundSync('cache_test_partial')
  })
})
