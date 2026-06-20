// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlayerControls } from '../src/hooks/usePlayerControls'
import { SpatialNavigationProvider } from '../src/contexts/SpatialNavigationContext'

const navigateSpatialMock = vi.fn()
// Mock spatial navigation
vi.mock('../src/contexts/SpatialNavigationContext', () => ({
  useSpatialNavigation: () => ({ navigate: navigateSpatialMock, activeLayer: 'base' }),
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
  let executeSeekMock
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
    executeSeekMock = vi.fn()
    
    seekTimeoutRef = { current: null }
    hudTimeoutRef = { current: null }
    
    vi.useFakeTimers()
  })

  it('updates local state correctly and calls executeSeek on debounce when scrolling', () => {
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
      currentTime: 30, // Global time 30s
      setCurrentTime: setCurrentTimeMock,
      seekTimeoutRef,
      hudTimeoutRef,
      executeSeek: executeSeekMock,
      activeMenu: 'none'
    }), { wrapper: SpatialNavigationProvider })

    // Bypass first scroll tick block
    act(() => {
      const wheelEvent1 = new WheelEvent('wheel', { deltaY: 1 })
      window.dispatchEvent(wheelEvent1)
    })
    
    // Dispatch second wheel event (seekAmount = +1)
    act(() => {
      const wheelEvent2 = new WheelEvent('wheel', { deltaY: -1 })
      window.dispatchEvent(wheelEvent2) 
    })

    // currentTime starts at 30, seek is +1, so it should be 31
    expect(setCurrentTimeMock).toHaveBeenCalledWith(31)
    
    // executeSeek should NOT be called immediately
    expect(executeSeekMock).not.toHaveBeenCalled()
    
    // Advance timers by 500ms
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Now executeSeek should be called with final target
    expect(executeSeekMock).toHaveBeenCalledWith(31)
  })

  it('triggers spatial navigation when ArrowLeft or ArrowRight are pressed and timeline is not focused', () => {
    renderHook(() => usePlayerControls({
      videoRef, navigate: navigateMock, duration: 100, showHUD: true,
      setShowHUD: setShowHUDMock, triggerHUD: triggerHUDMock,
      isDragging: false, isScrolling: false, setIsScrolling: setIsScrollingMock,
      currentTime: 30, setCurrentTime: setCurrentTimeMock,
      seekTimeoutRef, hudTimeoutRef, executeSeek: executeSeekMock, activeMenu: 'none'
    }), { wrapper: SpatialNavigationProvider })

    navigateSpatialMock.mockClear()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })

    expect(navigateSpatialMock).toHaveBeenCalledWith('right')
    expect(executeSeekMock).not.toHaveBeenCalled()
  })

  it('triggers executeSeek when ArrowLeft or ArrowRight are pressed and timeline IS focused', () => {
    // Create a mock timeline element and focus it
    const timeline = document.createElement('div')
    timeline.id = 'player-timeline'
    timeline.tabIndex = 0
    document.body.appendChild(timeline)
    timeline.focus()

    renderHook(() => usePlayerControls({
      videoRef, navigate: navigateMock, duration: 100, showHUD: true,
      setShowHUD: setShowHUDMock, triggerHUD: triggerHUDMock,
      isDragging: false, isScrolling: false, setIsScrolling: setIsScrollingMock,
      currentTime: 30, setCurrentTime: setCurrentTimeMock,
      seekTimeoutRef, hudTimeoutRef, executeSeek: executeSeekMock, activeMenu: 'none'
    }), { wrapper: SpatialNavigationProvider })

    navigateSpatialMock.mockClear()
    executeSeekMock.mockClear()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })

    // It should seek +30 seconds
    expect(executeSeekMock).toHaveBeenCalledWith(60)
    expect(setCurrentTimeMock).toHaveBeenCalledWith(60)
    expect(navigateSpatialMock).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(timeline)
  })
})
