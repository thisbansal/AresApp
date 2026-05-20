import { describe, it, expect, vi, beforeEach } from 'vitest'

// Initialize hoisting-safe global mock states
global.__mockStates = []
global.__mockStateIndex = 0
global.__triggerReRender = null
global.__prevDeps = []
global.__effectIndex = 0

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    useState: (initialVal) => {
      const currentIndex = global.__mockStateIndex
      if (global.__mockStates[currentIndex] === undefined) {
        global.__mockStates[currentIndex] = initialVal
      }
      const setter = (newVal) => {
        if (typeof newVal === 'function') {
          global.__mockStates[currentIndex] = newVal(global.__mockStates[currentIndex])
        } else {
          global.__mockStates[currentIndex] = newVal
        }
        // Safely trigger a simulated component re-render when state changes
        if (global.__triggerReRender) {
          global.__triggerReRender()
        }
      }
      global.__mockStateIndex++
      return [global.__mockStates[currentIndex], setter]
    },
    useEffect: (callback, deps) => {
      const currentIndex = global.__effectIndex
      const prevDeps = global.__prevDeps[currentIndex]

      let hasChanged = true
      if (prevDeps && deps) {
        hasChanged = deps.some((dep, i) => dep !== prevDeps[i])
      }

      if (hasChanged) {
        global.__prevDeps[currentIndex] = deps
        callback()
      }
      global.__effectIndex++
    },
    useCallback: (callback) => {
      return callback
    }
  }
})

// Mock AppStore to avoid React hook validation errors
vi.mock('../src/stores/AppStore', () => {
  const mockState = { token: null, serverUri: null, isLoading: true }
  return {
    useAppStore: vi.fn().mockImplementation((selector) => {
      return selector ? selector(mockState) : mockState
    })
  }
})

// Mock plexConnectionService
vi.mock('../src/services/plex/plexConnectionService', () => ({
  getActiveServerInfo: vi.fn()
}))

// Mock plexWatchedService
vi.mock('../src/services/plex/plexWatchedService', () => ({
  toggleWatchedState: vi.fn()
}))

// Mock plexContentService
vi.mock('../src/services/plex/plexContentService', () => ({
  getChildren: vi.fn()
}))

import { useActiveServer } from '../src/hooks/useActiveServer'
import { useToggleWatched } from '../src/hooks/useToggleWatched'
import { useEpisodes } from '../src/hooks/useEpisodes'
import { getActiveServerInfo } from '../src/services/plex/plexConnectionService'
import { toggleWatchedState } from '../src/services/plex/plexWatchedService'
import { getChildren } from '../src/services/plex/plexContentService'

/**
 * A lightweight, reactive hook test runner that mimics React component re-renders.
 */
function renderHook(hookFn) {
  const result = { current: null }
  const run = () => {
    global.__mockStateIndex = 0
    global.__effectIndex = 0
    result.current = hookFn()
  }
  global.__triggerReRender = run
  run()
  return result
}

describe('Custom React Hooks Unit Tests', () => {
  beforeEach(() => {
    global.__mockStates = []
    global.__mockStateIndex = 0
    global.__triggerReRender = null
    global.__prevDeps = []
    global.__effectIndex = 0
    vi.clearAllMocks()
  })

  describe('useActiveServer', () => {
    it('should immediately return provided initial serverInfo and not load', async () => {
      const initial = { uri: 'http://my-plex', token: 'token123' }
      const result = renderHook(() => useActiveServer(initial, null))
      
      const [serverInfo, loading] = result.current
      expect(serverInfo).toEqual(initial)
      expect(loading).toBe(false)
      expect(getActiveServerInfo).not.toHaveBeenCalled()
    })

    it('should fetch and resolve active server info when initial is null', async () => {
      const resolved = { uri: 'http://stored-plex', token: 'stored-token' }
      getActiveServerInfo.mockResolvedValue(resolved)

      const result = renderHook(() => useActiveServer(null, null))

      // Yield control to let async/await block execute
      await new Promise(r => setTimeout(r, 0))

      const [serverInfo, loading] = result.current
      expect(getActiveServerInfo).toHaveBeenCalled()
      expect(serverInfo).toEqual(resolved)
      expect(loading).toBe(false)
    })

    it('should navigate to home "/" on connection resolution error', async () => {
      const mockNavigate = vi.fn()
      getActiveServerInfo.mockRejectedValue(new Error('Auth failed'))

      const result = renderHook(() => useActiveServer(null, mockNavigate))

      // Yield control to let async/await block execute
      await new Promise(r => setTimeout(r, 0))

      const [serverInfo, loading] = result.current
      expect(getActiveServerInfo).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      expect(loading).toBe(false)
    })
  })

  describe('useToggleWatched', () => {
    it('should warn and return null if server credentials are not resolved', async () => {
      const result = renderHook(() => useToggleWatched(null))
      const toggle = result.current
      const state = await toggle({ id: 'item1' })
      expect(state).toBeNull()
      expect(toggleWatchedState).not.toHaveBeenCalled()
    })

    it('should scrobble state and return target state when credentials are valid', async () => {
      const serverInfo = { uri: 'http://plex', token: 'token' }
      toggleWatchedState.mockResolvedValue(true)

      const result = renderHook(() => useToggleWatched(serverInfo))
      const toggle = result.current
      const state = await toggle({ id: 'item1', title: 'Movie 1' })

      expect(toggleWatchedState).toHaveBeenCalledWith('http://plex', 'token', { id: 'item1', title: 'Movie 1' })
      expect(state).toBe(true)
    })

    it('should return null if scrobble fails/throws', async () => {
      const serverInfo = { uri: 'http://plex', token: 'token' }
      toggleWatchedState.mockRejectedValue(new Error('Network error'))

      const result = renderHook(() => useToggleWatched(serverInfo))
      const toggle = result.current
      const state = await toggle({ id: 'item1' })

      expect(state).toBeNull()
    })
  })

  describe('useEpisodes', () => {
    it('should return empty episodes if serverInfo or seasonId is missing', () => {
      const result = renderHook(() => useEpisodes(null, null))
      const [episodes, setEpisodes, loading] = result.current
      expect(episodes).toEqual([])
      expect(loading).toBe(false)
      expect(getChildren).not.toHaveBeenCalled()
    })

    it('should fetch episodes from content service when parameters are loaded', async () => {
      const serverInfo = { uri: 'http://plex', token: 'token' }
      const mockEpisodesList = [{ id: 'ep1', title: 'Episode 1' }]
      getChildren.mockResolvedValue(mockEpisodesList)

      const result = renderHook(() => useEpisodes(serverInfo, 100))

      // Yield control to let async/await block execute
      await new Promise(r => setTimeout(r, 0))

      const [episodes, setEpisodes, loading] = result.current
      expect(getChildren).toHaveBeenCalledWith('http://plex', 'token', 100)
      expect(episodes).toEqual(mockEpisodesList)
    })
  })
})
