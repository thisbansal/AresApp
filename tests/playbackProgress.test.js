import { describe, it, expect, vi, beforeEach } from 'vitest'

// Setup global mock variables for React hooks testing
global.__mockStates = []
global.__mockStateIndex = 0
global.__effectIndex = 0
global.__prevDeps = []
global.__triggerReRender = null

// Mock react
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
        if (global.__triggerReRender) global.__triggerReRender()
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
        // Run callback and store cleanup function
        const cleanup = callback()
        if (typeof cleanup === 'function') {
          global.__cleanups[currentIndex] = cleanup
        }
      }
      global.__effectIndex++
    },
    useRef: (initialVal) => {
      const refIndex = global.__mockRefIndex++
      if (!global.__mockRefs[refIndex]) {
        global.__mockRefs[refIndex] = { current: initialVal }
      }
      return global.__mockRefs[refIndex]
    }
  }
})

// Mock plexBridge
vi.mock('../src/services/plex/plexBridge', () => ({
  plexBridge: {
    request: vi.fn()
  }
}))

import { updatePlaybackProgress } from '../src/services/plex/plexPlaybackService'
import { usePlaybackProgress } from '../src/hooks/usePlaybackProgress'
import { plexBridge } from '../src/services/plex/plexBridge'

describe('Playback Progress Synchronization Tests', () => {
  beforeEach(() => {
    global.__mockStates = []
    global.__mockStateIndex = 0
    global.__effectIndex = 0
    global.__mockRefIndex = 0
    global.__mockRefs = []
    global.__prevDeps = []
    global.__cleanups = {}
    global.__triggerReRender = null
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({}))
  })

  describe('plexPlaybackService', () => {
    it('should skip progress update if params are missing', async () => {
      const res = await updatePlaybackProgress('', '', '', 5000, 'playing')
      expect(res).toBe(false)
      expect(plexBridge.request).not.toHaveBeenCalled()
    })

    it('should trigger GET request to /:/timeline with correct params', async () => {
      plexBridge.request.mockResolvedValue({ ok: true })
      const res = await updatePlaybackProgress('http://my-server', 'token123', 'ratingKey456', 15000, 'playing')
      
      expect(res).toBe(true)
      expect(plexBridge.request).toHaveBeenCalledWith(
        '/:/timeline?ratingKey=ratingKey456&key=%2Flibrary%2Fmetadata%2FratingKey456&identifier=com.plexapp.plugins.library&time=15000&state=playing',
        { method: 'GET' },
        { uri: 'http://my-server', token: 'token123' }
      )
    })
  })

  describe('usePlaybackProgress Hook', () => {
    it('should attach loadedmetadata event listener and seek on load', () => {
      const mockVideo = {
        currentTime: 0,
        readyState: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
      const videoRef = { current: mockVideo }
      
      usePlaybackProgress({
        serverInfo: { uri: 'http://server', token: 'token' },
        ratingKey: 'key123',
        videoRef,
        viewOffset: 30000, // 30 seconds
        startOver: false
      })

      // Must add loadedmetadata listener
      expect(mockVideo.addEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function))
      
      // Simulate loadedmetadata event
      const loadedMetadataCallback = mockVideo.addEventListener.mock.calls.find(call => call[0] === 'loadedmetadata')[1]
      loadedMetadataCallback()

      expect(mockVideo.currentTime).toBe(30)
    })

    it('should ignore offset and not seek if startOver is true', () => {
      const mockVideo = {
        currentTime: 0,
        readyState: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
      const videoRef = { current: mockVideo }

      usePlaybackProgress({
        serverInfo: { uri: 'http://server', token: 'token' },
        ratingKey: 'key123',
        videoRef,
        viewOffset: 30000,
        startOver: true
      })

      // Simulate loadedmetadata event
      const loadedMetadataCallback = mockVideo.addEventListener.mock.calls.find(call => call[0] === 'loadedmetadata')[1]
      loadedMetadataCallback()

      expect(mockVideo.currentTime).toBe(0)
    })

    it('should trigger fetch beacon keepalive on unmount when progress has elapsed', () => {
      const mockVideo = {
        currentTime: 45,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
      const videoRef = { current: mockVideo }

      usePlaybackProgress({
        serverInfo: { uri: 'http://server', token: 'token' },
        ratingKey: 'key123',
        videoRef,
        viewOffset: 0,
        startOver: false
      })

      // Simulate a timeupdate event to update progressRef.current
      const timeupdateCallback = mockVideo.addEventListener.mock.calls.find(call => call[0] === 'timeupdate')[1]
      timeupdateCallback()

      // Simulate unmount by calling cleanups
      Object.values(global.__cleanups).forEach(cleanup => {
        if (typeof cleanup === 'function') cleanup()
      })

      // Hook unmounted, verify fetch was called with keepalive
      expect(global.fetch).toHaveBeenCalled()
      const fetchCall = global.fetch.mock.calls[0]
      expect(fetchCall[0]).toContain('/:/timeline')
      expect(fetchCall[0]).toContain('state=stopped')
      expect(fetchCall[1].keepalive).toBe(true)
    })
  })
})
