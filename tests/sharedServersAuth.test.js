import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSharedServerToken, discoverSharedServer } from '../src/services/plex/sharedServerService'
import { useAppStore } from '../src/stores/AppStore'
import { useServerStore } from '../src/stores/serverStore'
import { getData, setData } from '../src/services/luna/lunaService'
import { getBestServerConnection, testConnectionToServer } from '../src/services/plex/plexAPIServer'

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
}
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
}
global.localStorage = localStorageMock
global.sessionStorage = sessionStorageMock

vi.mock('../src/services/luna/lunaService', () => ({
  getData: vi.fn(),
  setData: vi.fn(),
  DB_KINDS: { SERVER: 'server' }
}))

vi.mock('../src/services/plex/plexAPIServer', () => ({
  getServers: vi.fn(),
  testConnectionToServer: vi.fn(),
  getBestServerConnection: vi.fn()
}))

// Mock global fetch
global.fetch = vi.fn()

describe('Shared Servers Authentication and Store Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      mainToken: 'global-main-token',
      token: 'global-main-token',
      hasServer: false,
      selectedLibraryIds: [],
      selectedLibrariesByServer: {}
    })
    useServerStore.setState({
      activeServer: null
    })
  })

  describe('getSharedServerToken Caching and Fallbacks', () => {
    it('should return cached token directly if not expired and reachable', async () => {
      const mockCache = {
        'shared-client-1': {
          token: 'cached-token-123',
          uri: 'http://shared-server-ip',
          timestamp: Date.now()
        }
      }
      getData.mockResolvedValueOnce(mockCache)
      testConnectionToServer.mockResolvedValueOnce(true)

      const result = await getSharedServerToken('global-main-token', 'shared-client-1', null)

      expect(result.token).toBe('cached-token-123')
      expect(result.uri).toBe('http://shared-server-ip')
      expect(testConnectionToServer).toHaveBeenCalledWith('http://shared-server-ip', 'cached-token-123', 1500)
    })

    it('should run Person 1 Flow (direct resources token lookup) when NO owned server exists in resources', async () => {
      getData.mockResolvedValueOnce({}) // Empty cache
      
      const mockResources = [
        {
          provides: 'server',
          clientIdentifier: 'shared-client-1',
          accessToken: 'direct-shared-token',
          owned: false,
          connections: [{ uri: 'http://shared-server:32400', local: true }]
        }
      ]

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResources
      })
      testConnectionToServer.mockResolvedValueOnce(true)

      const result = await getSharedServerToken('global-main-token', 'shared-client-1', null)

      expect(result.token).toBe('direct-shared-token')
      expect(result.uri).toBe('http://shared-server:32400')
    })

    it('should resolve shared server token directly from resources even if an owned server exists in resources', async () => {
      getData.mockResolvedValueOnce({}) // Empty cache

      const mockResources = [
        {
          provides: 'server',
          clientIdentifier: 'shared-client-1',
          accessToken: 'direct-shared-token',
          owned: false,
          connections: [{ uri: 'http://shared-server:32400', local: true }]
        },
        {
          provides: 'server',
          clientIdentifier: 'owned-client-1',
          accessToken: 'owned-token',
          owned: true,
          connections: [{ uri: 'http://owned-server:32400', local: true }]
        }
      ]

      // 1. Fetch resources
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResources
      })

      // 2. Mock test connection check on shared server
      testConnectionToServer.mockResolvedValueOnce(true)

      const result = await getSharedServerToken('global-main-token', 'shared-client-1', null)

      expect(result.token).toBe('direct-shared-token')
      expect(result.uri).toBe('http://shared-server:32400')
    })
  })

  describe('AppStore hasServer Integration', () => {
    it('should set hasServer to true when calling setSelectedLibrariesForServer', async () => {
      expect(useAppStore.getState().hasServer).toBe(false)

      await useAppStore.getState().setSelectedLibrariesForServer('shared-client-1', ['lib1', 'lib2'])

      const state = useAppStore.getState()
      expect(state.hasServer).toBe(true)
      expect(state.selectedLibrariesByServer['shared-client-1']).toEqual(['lib1', 'lib2'])
    })
  })
})
