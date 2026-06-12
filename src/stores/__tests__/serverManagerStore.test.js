import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useServerManagerStore } from '../serverManagerStore'
import { getData, setData, DB_KINDS } from '../../services/luna/lunaService'
import { getServers, getBestServerConnection } from '../../services/plex/plexAPIServer'

// Mock dependencies
vi.mock('../../services/luna/lunaService', () => ({
  getData: vi.fn(),
  setData: vi.fn(),
  DB_KINDS: {
    SERVER: 'servers_kind'
  }
}))

vi.mock('../../services/plex/plexAPIServer', () => ({
  getServers: vi.fn(),
  getBestServerConnection: vi.fn()
}))

describe('serverManagerStore', () => {
  beforeEach(() => {
    useServerManagerStore.setState({
      servers: {},
      isDiscovering: false
    })
    vi.clearAllMocks()
  })

  it('should initialize with empty servers', () => {
    const state = useServerManagerStore.getState()
    expect(state.servers).toEqual({})
    expect(state.isDiscovering).toBe(false)
  })

  it('should correctly add and retrieve an owned server', async () => {
    const store = useServerManagerStore.getState()
    const mockOwnedServer = {
      name: 'My Owned Server',
      clientIdentifier: 'owned-123',
      accessToken: 'token-abc',
      uri: 'http://192.168.1.100:32400',
      owned: true,
      connections: []
    }

    const newServers = { 'owned-123': mockOwnedServer }
    useServerManagerStore.setState({ servers: newServers })
    
    // Attempt retrieval
    const retrieved = useServerManagerStore.getState().getServer('owned-123')
    expect(retrieved).toBeDefined()
    expect(retrieved.owned).toBe(true)
    expect(retrieved.name).toBe('My Owned Server')
  })

  it('should sync owned server token to active profile fallbackToken on loadCachedServers', async () => {
    const mockCachedServers = {
      'owned-123': {
        name: 'My Owned Server',
        clientIdentifier: 'owned-123',
        accessToken: 'old-main-token',
        uri: 'http://192.168.1.100:32400',
        owned: true,
        connections: []
      },
      'shared-456': {
        name: 'Shared Server',
        clientIdentifier: 'shared-456',
        accessToken: 'shared-token-remains',
        uri: 'http://192.168.1.105:32400',
        owned: false,
        connections: []
      }
    }

    getData.mockResolvedValue(mockCachedServers)

    // Call loadCachedServers with fallbackToken = 'new-user-token' and profileId = 'user_1'
    await useServerManagerStore.getState().loadCachedServers('new-user-token', 'user_1')

    const servers = useServerManagerStore.getState().servers
    
    // Owned server token should be updated to the profile's user token
    expect(servers['owned-123'].accessToken).toBe('new-user-token')
    
    // Shared server token should NOT be updated
    expect(servers['shared-456'].accessToken).toBe('shared-token-remains')

    expect(getData).toHaveBeenCalledWith('servers_kind', 'multiServerCache_global')
  })

  it('should discover servers using user token and cache the result with profileId', async () => {
    const mockDiscoveredResources = [
      {
        name: 'My Owned Server',
        clientIdentifier: 'owned-123',
        accessToken: 'this-should-be-overwritten-by-user-token',
        owned: true,
        connections: [{ uri: 'http://192.168.1.100:32400', local: true }]
      }
    ]

    getServers.mockResolvedValue(mockDiscoveredResources)
    getBestServerConnection.mockResolvedValue('http://192.168.1.100:32400')

    // Call discoverAllServers with the profile user token and profile ID
    await useServerManagerStore.getState().discoverAllServers('active-user-token', 'user_1')

    const state = useServerManagerStore.getState()
    expect(state.isDiscovering).toBe(false)
    
    // Verify saveServersToCache called with correct profileId
    expect(setData).toHaveBeenCalledWith(
      'servers_kind',
      'multiServerCache_global',
      expect.objectContaining({
        'owned-123': expect.objectContaining({
          name: 'My Owned Server',
          clientIdentifier: 'owned-123',
          uri: 'http://192.168.1.100:32400'
        })
      })
    )
  })
})
