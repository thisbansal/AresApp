// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlayerControls } from '../src/hooks/usePlayerControls'
import { SpatialNavigationProvider } from '../src/contexts/SpatialNavigationContext'

// Mock spatial navigation
vi.mock('../src/contexts/SpatialNavigationContext', () => ({
  useSpatialNavigation: () => ({ navigate: vi.fn() }),
  SpatialNavigationProvider: ({ children }) => children
}))

describe('usePlayerControls', () => {
  let videoEl
  let videoRef
  let navigateMock
  let setShowHUDMock
  let triggerHUDMock
  let setIsScrollingMock
  let setCurrentTimeMock
  let seekTimeoutRef
  let hudTimeoutRef

  beforeEach(() => {
    videoEl = document.createElement('video')
    Object.defineProperty(videoEl, 'duration', { value: 100 })
    videoEl.pause = vi.fn()
    videoEl.play = vi.fn().mockResolvedValue()
    
    videoRef = { current: videoEl }
    navigateMock = vi.fn()
    setShowHUDMock = vi.fn()
    triggerHUDMock = vi.fn()
    setIsScrollingMock = vi.fn()
    setCurrentTimeMock = vi.fn()
    
    seekTimeoutRef = { current: null }
    hudTimeoutRef = { current: null }
    
    vi.useFakeTimers()
  })

  it('adds transcodeOffset when scrubbing via wheel events', () => {
    // Current time is exactly 0
    videoEl.currentTime = 0
    
    renderHook(() => usePlayerControls({
      videoRef,
      navigate: navigateMock,
      duration: 100,
      showHUD: true,
      setShowHUD: setShowHUDMock,
      triggerHUD: triggerHUDMock,
      isDragging: false,
      isScrolling: false,
      setIsScrolling: setIsScrollingMock,
      setCurrentTime: setCurrentTimeMock,
      seekTimeoutRef,
      hudTimeoutRef,
      transcodeOffset: 30000 // 30 second offset
    }), { wrapper: SpatialNavigationProvider })

    // Need to bypass the shouldPause logic that absorbs first scroll tick
    act(() => {
      const wheelEvent1 = new WheelEvent('wheel', { deltaY: 1 })
      window.dispatchEvent(wheelEvent1)
    })
    
    // Dispatch second wheel event (seekAmount = -1, but bound to 0 native)
    act(() => {
      const wheelEvent2 = new WheelEvent('wheel', { deltaY: -1 })
      window.dispatchEvent(wheelEvent2) 
    })

    // Because we scroll deltaY: -1, seekAmount is 1. 
    // newTime = native 0 + 1 = 1
    // setCurrentTime should receive newTime(1) + transcodeOffset(30) = 31
    expect(setCurrentTimeMock).toHaveBeenCalledWith(31)
    
    // the native videoEl should receive the pure seek time without offset
    expect(videoEl.currentTime).toBe(1)
  })
})
