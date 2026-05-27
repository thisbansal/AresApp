// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlaybackProgress } from '../src/hooks/usePlaybackProgress'
import * as plexPlaybackService from '../src/services/plex/plexPlaybackService'

// Mock the plex service
vi.mock('../src/services/plex/plexPlaybackService', () => ({
  updatePlaybackProgress: vi.fn()
}))

describe('usePlaybackProgress', () => {
  const mockServerInfo = { uri: 'http://test:32400', token: 'test-token' }
  const mockRatingKey = '123'
  const mockPlayQueueItemID = '456'
  
  let videoEl
  let videoRef

  beforeEach(() => {
    vi.clearAllMocks()
    videoEl = document.createElement('video')
    videoRef = { current: videoEl }
    
    // Mock navigator.sendBeacon
    global.navigator.sendBeacon = vi.fn()
  })

  it('reports progress periodically', async () => {
    renderHook(() => usePlaybackProgress({
      serverInfo: mockServerInfo,
      ratingKey: mockRatingKey,
      playQueueItemID: mockPlayQueueItemID,
      videoRef,
      viewOffset: 0,
      startOver: false,
      isBuffering: false,
      isPlaying: true,
      duration: 100000
    }))

    // Simulate play
    act(() => {
      videoEl.dispatchEvent(new Event('play'))
    })
    
    expect(plexPlaybackService.updatePlaybackProgress).toHaveBeenCalledWith(
      mockServerInfo.uri, mockServerInfo.token, mockRatingKey, mockPlayQueueItemID, 0, 100000, 'playing'
    )
    
    // Fast forward 15 seconds
    act(() => {
      videoEl.currentTime = 15
      videoEl.dispatchEvent(new Event('timeupdate'))
    })

    expect(plexPlaybackService.updatePlaybackProgress).toHaveBeenCalledWith(
      mockServerInfo.uri, mockServerInfo.token, mockRatingKey, mockPlayQueueItemID, 15000, 100000, 'playing'
    )
  })

  it('does not propagate NaN duration when metadata duration is missing and video duration is NaN', async () => {
    // Explicitly set video duration to NaN (simulating early hls.js load state)
    Object.defineProperty(videoEl, 'duration', { value: NaN })

    renderHook(() => usePlaybackProgress({
      serverInfo: mockServerInfo,
      ratingKey: mockRatingKey,
      playQueueItemID: mockPlayQueueItemID,
      videoRef,
      viewOffset: 0,
      startOver: false,
      isBuffering: false,
      isPlaying: true,
      duration: undefined // No duration from metadata
    }))

    act(() => {
      videoEl.currentTime = 5
      videoEl.dispatchEvent(new Event('pause'))
    })

    // Expect duration to safely fallback to 1 instead of NaN
    expect(plexPlaybackService.updatePlaybackProgress).toHaveBeenCalledWith(
      mockServerInfo.uri, mockServerInfo.token, mockRatingKey, mockPlayQueueItemID, 5000, 1, 'paused'
    )
  })

  it('ignores phantom zero pings before seek completes', async () => {
    renderHook(() => usePlaybackProgress({
      serverInfo: mockServerInfo,
      ratingKey: mockRatingKey,
      playQueueItemID: mockPlayQueueItemID,
      videoRef,
      viewOffset: 50000, // User has an existing offset
      startOver: false,
      isBuffering: false,
      isPlaying: true,
      duration: 100000
    }))

    // Simulate a timeupdate event firing at 0 seconds (e.g. hls.js booting up before jumping)
    act(() => {
      videoEl.currentTime = 0
      videoEl.dispatchEvent(new Event('timeupdate'))
    })

    // It should completely ignore this phantom 0 ping to protect the user's progress!
    expect(plexPlaybackService.updatePlaybackProgress).not.toHaveBeenCalled()
  })

  it('sends beacon with final progress on unmount', () => {
    const { unmount } = renderHook(() => usePlaybackProgress({
      serverInfo: mockServerInfo,
      ratingKey: mockRatingKey,
      playQueueItemID: mockPlayQueueItemID,
      videoRef,
      viewOffset: 0,
      startOver: false,
      isBuffering: false,
      isPlaying: true,
      duration: 100000
    }))

    act(() => {
      videoEl.currentTime = 120
      videoEl.dispatchEvent(new Event('timeupdate'))
    })

    // Trigger cleanup
    unmount()

    // sendBeacon should have been called
    expect(global.navigator.sendBeacon).toHaveBeenCalled()
    const beaconUrl = global.navigator.sendBeacon.mock.calls[0][0]
    
    // The url should contain the correct time and state
    expect(beaconUrl).toContain('time=120000')
    expect(beaconUrl).toContain('state=stopped')
    expect(beaconUrl).toContain(`playQueueItemID=${mockPlayQueueItemID}`)
  })
})
