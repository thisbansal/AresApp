import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getActiveServerInfo } from '../src/services/plex/plexConnectionService'
import { isMediaWatched, toggleWatchedState } from '../src/services/plex/plexWatchedService'
import { getMainToken } from '../src/services/luna/tokenStorage'
import { getData } from '../src/services/luna/lunaService'
import { markAsWatched, markAsUnwatched } from '../src/services/plex/plexContentService'
import { useNotificationStore } from '../src/services/notifications/notificationStore'
import { useAppStore } from '../src/stores/AppStore'
import { useServerStore } from '../src/stores/serverStore'

// Mock the dependencies
vi.mock('../src/services/luna/tokenStorage', () => ({
  getMainToken: vi.fn()
}))

vi.mock('../src/services/luna/lunaService', () => ({
  getData: vi.fn(),
  DB_KINDS: { SERVER: 'server' }
}))

vi.mock('../src/services/plex/plexContentService', () => ({
  markAsWatched: vi.fn(),
  markAsUnwatched: vi.fn()
}))

describe('Plex Connection Service', () => {
  beforeEach(() => {
    useAppStore.setState({
      token: null,
      serverUri: null
    })
    useServerStore.setState({
      activeServer: null
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return serverInfo if uri and token are already provided', async () => {
    const input = { uri: 'http://my-plex:32400', token: 'token-123' }
    const result = await getActiveServerInfo(input)
    expect(result).toEqual(input)
    expect(getMainToken).not.toHaveBeenCalled()
  })

  it('should prefer the active profile session from AppStore before falling back to main token storage', async () => {
    useAppStore.setState({
      token: 'profile-token',
      serverUri: 'http://profile-plex:32400'
    })

    const result = await getActiveServerInfo(null)

    expect(result).toEqual({
      uri: 'http://profile-plex:32400',
      token: 'profile-token'
    })
    expect(getMainToken).not.toHaveBeenCalled()
    expect(getData).not.toHaveBeenCalled()
  })

  it('should prefer the resolved active server token from ServerStore when available', async () => {
    useAppStore.setState({
      token: 'profile-token',
      serverUri: 'http://profile-plex:32400'
    })
    useServerStore.setState({
      activeServer: {
        uri: 'http://shared-plex:32400',
        token: 'server-access-token'
      }
    })

    const result = await getActiveServerInfo(null)

    expect(result).toEqual({
      uri: 'http://shared-plex:32400',
      token: 'server-access-token'
    })
    expect(getMainToken).not.toHaveBeenCalled()
    expect(getData).not.toHaveBeenCalled()
  })

  it('should load server info from storage when local state is empty', async () => {
    getMainToken.mockResolvedValue('stored-token')
    getData.mockResolvedValue('http://stored-plex:32400')

    const result = await getActiveServerInfo(null)
    expect(result).toEqual({
      uri: 'http://stored-plex:32400',
      token: 'stored-token'
    })
    expect(getMainToken).toHaveBeenCalled()
    expect(getData).toHaveBeenCalled()
  })

  it('should throw an error if no token or uri can be resolved', async () => {
    getMainToken.mockResolvedValue(null)
    getData.mockResolvedValue(null)

    await expect(getActiveServerInfo(null)).rejects.toThrow('No active Plex server connection or authorization token found.')
  })
})

describe('Plex Watched Service', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('isMediaWatched', () => {
    it('should return false if item is null or missing', () => {
      expect(isMediaWatched(null)).toBe(false)
      expect(isMediaWatched(undefined)).toBe(false)
      expect(isMediaWatched()).toBe(false)
    })

    it('should identify a watched movie/episode by viewCount > 0', () => {
      const episode = { type: 'episode', viewCount: 1 }
      expect(isMediaWatched(episode)).toBe(true)

      const unwatchedEpisode = { type: 'episode', viewCount: 0 }
      expect(isMediaWatched(unwatchedEpisode)).toBe(false)
    })

    it('should identify a watched show/season by leafCount matching viewedLeafCount', () => {
      const show = { type: 'show', leafCount: 10, viewedLeafCount: 10 }
      expect(isMediaWatched(show)).toBe(true)

      const partialShow = { type: 'show', leafCount: 10, viewedLeafCount: 5 }
      expect(isMediaWatched(partialShow)).toBe(false)
    })

    it('should check viewCount/viewedLeafCount if leafCount is missing for show/season', () => {
      const show = { type: 'show', viewCount: 1 }
      expect(isMediaWatched(show)).toBe(true)

      const unwatchedShow = { type: 'show', viewCount: 0, viewedLeafCount: 0 }
      expect(isMediaWatched(unwatchedShow)).toBe(false)
    })
  })

  describe('toggleWatchedState', () => {
    it('should throw if required parameters are missing', async () => {
      await expect(toggleWatchedState(null, 'token', {})).rejects.toThrow()
    })

    it('should scrobble when unwatched and notify success', async () => {
      const item = { id: 'item1', title: 'Test Movie', viewCount: 0 }
      markAsWatched.mockResolvedValue(true)

      const result = await toggleWatchedState('http://uri', 'token', item)
      
      expect(result).toBe(true)
      expect(markAsWatched).toHaveBeenCalledWith('http://uri', 'token', 'item1')
      expect(markAsUnwatched).not.toHaveBeenCalled()
    })

    it('should unscrobble when watched and notify success', async () => {
      const item = { id: 'item2', title: 'Test Show', viewCount: 1 }
      markAsUnwatched.mockResolvedValue(true)

      const result = await toggleWatchedState('http://uri', 'token', item)

      expect(result).toBe(false)
      expect(markAsUnwatched).toHaveBeenCalledWith('http://uri', 'token', 'item2')
      expect(markAsWatched).not.toHaveBeenCalled()
    })
  })
})
