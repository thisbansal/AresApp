import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAccessibleServers, resolveAccessibleServer } from '../src/services/plex/plexAccessService'
import { getServers, getBestServerConnection, testConnectionToServer } from '../src/services/plex/plexAPIServer'

vi.mock('../src/services/plex/plexAPIServer', () => ({
  getServers: vi.fn(),
  getBestServerConnection: vi.fn(),
  testConnectionToServer: vi.fn()
}))

describe('plexAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all PMS resources accessible to the current token', async () => {
    const resources = [
      { name: 'Owner Server', connections: [], owned: true },
      { name: 'Shared Server', connections: [], owned: false }
    ]
    getServers.mockResolvedValue(resources)

    const result = await getAccessibleServers('profile-token')

    expect(getServers).toHaveBeenCalledWith('profile-token')
    expect(result).toEqual(resources)
  })

  it('should reuse the preferred URI when it is reachable for the current profile', async () => {
    getServers.mockResolvedValue([
      {
        name: 'Shared Server',
        connections: [{ uri: 'http://shared:32400', local: false, relay: false }]
      }
    ])
    testConnectionToServer.mockResolvedValue(true)

    const result = await resolveAccessibleServer('profile-token', 'http://shared:32400')

    expect(testConnectionToServer).toHaveBeenCalledWith('http://shared:32400', 'profile-token', 1500)
    expect(getBestServerConnection).not.toHaveBeenCalled()
    expect(result).toEqual({
      uri: 'http://shared:32400',
      token: 'profile-token',
      server: {
        name: 'Shared Server',
        connections: [{ uri: 'http://shared:32400', local: false, relay: false }]
      }
    })
  })

  it('should fall back to the best reachable accessible server when the preferred URI is unavailable', async () => {
    const sharedServer = {
      name: 'Shared Server',
      connections: [{ uri: 'http://shared:32400', local: false, relay: false }]
    }

    getServers.mockResolvedValue([sharedServer])
    getBestServerConnection.mockResolvedValue('http://shared:32400')

    const result = await resolveAccessibleServer('profile-token', 'http://missing:32400')

    expect(getBestServerConnection).toHaveBeenCalledWith(sharedServer, 'profile-token')
    expect(result).toEqual({
      uri: 'http://shared:32400',
      token: 'profile-token',
      server: sharedServer
    })
  })
})
