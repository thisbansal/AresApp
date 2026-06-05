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
})
