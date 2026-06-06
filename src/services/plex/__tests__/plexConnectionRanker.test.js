import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortConnectionsByRank, getLatencyCache, saveLatency, probeLatency } from '../plexConnectionRanker'
import { universalStorage } from '../../UniversalStorage/universalStorage'

// Mock UniversalStorage
vi.mock('../../UniversalStorage/universalStorage', () => {
  let store = {}
  return {
    universalStorage: {
      get: vi.fn().mockImplementation((key) => Promise.resolve(store[key] || null)),
      set: vi.fn().mockImplementation((key, val) => {
        store[key] = val
        return Promise.resolve()
      }),
      delete: vi.fn().mockImplementation((key) => {
        delete store[key]
        return Promise.resolve()
      })
    }
  }
})

global.fetch = vi.fn()

describe('plexConnectionRanker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset universalStorage mock internally
    universalStorage.set('plex_connection_latencies', null)
  })

  it('should successfully save and retrieve latency cache', async () => {
    await saveLatency('http://test-uri:32400', 45)
    const cache = await getLatencyCache()

    expect(cache['http://test-uri:32400']).toBeDefined()
    expect(cache['http://test-uri:32400'].latency).toBe(45)
  })

  it('should sort connections based on cached latency (fastest first)', async () => {
    const connections = [
      { uri: 'http://slow-uri:32400', local: true },
      { uri: 'http://fast-uri:32400', local: true },
      { uri: 'http://mid-uri:32400', local: true }
    ]

    await saveLatency('http://slow-uri:32400', 500)
    await saveLatency('http://fast-uri:32400', 20)
    await saveLatency('http://mid-uri:32400', 120)

    const sorted = await sortConnectionsByRank(connections)
    expect(sorted[0].uri).toBe('http://fast-uri:32400')
    expect(sorted[1].uri).toBe('http://mid-uri:32400')
    expect(sorted[2].uri).toBe('http://slow-uri:32400')
  })

  it('should prioritize connections with cached latency over connections without cache', async () => {
    const connections = [
      { uri: 'http://no-cache-uri:32400', local: true },
      { uri: 'http://cached-uri:32400', local: true }
    ]

    await saveLatency('http://cached-uri:32400', 80)

    const sorted = await sortConnectionsByRank(connections)
    expect(sorted[0].uri).toBe('http://cached-uri:32400')
    expect(sorted[1].uri).toBe('http://no-cache-uri:32400')
  })

  it('should sort by default connection priority (Local > Remote > Relay) if no latency cache is present', async () => {
    const connections = [
      { uri: 'http://relay-uri:32400', local: false, relay: true },
      { uri: 'http://remote-uri:32400', local: false, relay: false },
      { uri: 'http://local-uri:32400', local: true, relay: false }
    ]

    const sorted = await sortConnectionsByRank(connections)
    expect(sorted[0].uri).toBe('http://local-uri:32400')
    expect(sorted[1].uri).toBe('http://remote-uri:32400')
    expect(sorted[2].uri).toBe('http://relay-uri:32400')
  })

  it('should probe a connection and save its latency', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true })

    const latency = await probeLatency('http://probe-test:32400', 'dummy-token', 1000)
    expect(latency).not.toBeNull()
    expect(latency).toBeGreaterThanOrEqual(0)

    const cache = await getLatencyCache()
    expect(cache['http://probe-test:32400']).toBeDefined()
    expect(cache['http://probe-test:32400'].latency).toBe(latency)
  })
})
