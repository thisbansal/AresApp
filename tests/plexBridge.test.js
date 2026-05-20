import { describe, it, expect, vi, beforeEach } from 'vitest'
import { plexBridge } from '../src/services/plex/plexBridge'
import { useServerStore } from '../src/stores/serverStore'
import { getActiveServerInfo } from '../src/services/plex/plexConnectionService'

vi.mock('../src/services/plex/plexConnectionService', () => ({
  getActiveServerInfo: vi.fn()
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('plexBridge and useServerStore Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useServerStore.setState({
      isOnline: true,
      lastChecked: null,
      connectionError: null,
      activeServer: null,
      logs: []
    })
  })

  describe('useServerStore state management', () => {
    it('should set online status correctly', () => {
      useServerStore.getState().setServerState(false, 'Disconnected')
      const state = useServerStore.getState()
      expect(state.isOnline).toBe(false)
      expect(state.connectionError).toBe('Disconnected')
      expect(state.lastChecked).not.toBeNull()
    })

    it('should log messages with appropriate severity levels', () => {
      useServerStore.getState().log('ERROR', 'Failed fetch', { code: 500 })
      const logs = useServerStore.getState().logs
      expect(logs.length).toBe(1)
      expect(logs[0].severity).toBe('ERROR')
      expect(logs[0].message).toBe('Failed fetch')
    })
  })

  describe('plexBridge.ping', () => {
    it('should set online true on successful ping response', async () => {
      getActiveServerInfo.mockResolvedValue({ uri: 'http://pms', token: 'tok' })
      global.fetch.mockResolvedValue({ ok: true })

      const result = await plexBridge.ping()
      expect(result).toBe(true)
      expect(useServerStore.getState().isOnline).toBe(true)
    })

    it('should set online false on ping failure', async () => {
      getActiveServerInfo.mockResolvedValue({ uri: 'http://pms', token: 'tok' })
      global.fetch.mockRejectedValue(new Error('Connection refused'))

      const result = await plexBridge.ping()
      expect(result).toBe(false)
      expect(useServerStore.getState().isOnline).toBe(false)
      expect(useServerStore.getState().connectionError).toBe('Connection refused')
    })
  })

  describe('plexBridge.request', () => {
    it('should resolve credentials, append token and forward fetch call', async () => {
      getActiveServerInfo.mockResolvedValue({ uri: 'http://pms', token: 'tok' })
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })

      const response = await plexBridge.request('/library/sections')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://pms/library/sections?X-Plex-Token=tok',
        expect.any(Object)
      )
      expect(response.ok).toBe(true)
    })

    it('should use the explicitly provided server context for profile-scoped requests', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })

      await plexBridge.request('/library/sections', {}, { uri: 'http://shared-pms', token: 'profile-token' })

      expect(getActiveServerInfo).not.toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalledWith(
        'http://shared-pms/library/sections?X-Plex-Token=profile-token',
        expect.any(Object)
      )
      expect(useServerStore.getState().activeServer).toEqual({
        uri: 'http://shared-pms',
        token: 'profile-token'
      })
    })

    it('should set online false on network error', async () => {
      getActiveServerInfo.mockResolvedValue({ uri: 'http://pms', token: 'tok' })
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(plexBridge.request('/library/sections')).rejects.toThrow()
      expect(useServerStore.getState().isOnline).toBe(false)
    })
  })
})
