// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SpatialNavigationProvider, useSpatialNavigation } from '../src/contexts/SpatialNavigationContext'
import { useBrowserStore } from '../src/stores/browserStore'

describe('SpatialNavigationContext - Navbar Expanded Wheel Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should map wheel deltaY > 0 to ArrowDown and deltaY < 0 to ArrowUp when navbar is expanded', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    
    const { result } = renderHook(() => useSpatialNavigation(), {
      wrapper: SpatialNavigationProvider
    })

    // Force navbar to expand
    act(() => {
      result.current.setIsNavbarExpanded(true)
    })

    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
    })

    // Expect an ArrowDown event
    let downEvent = dispatchEventSpy.mock.calls.find(call => call[0] instanceof KeyboardEvent && call[0].key === 'ArrowDown')
    expect(downEvent).toBeTruthy()

    dispatchEventSpy.mockClear()

    act(() => {
      // Simulate wheel cooldown
      vi.advanceTimersByTime(200)
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }))
    })

    // Expect an ArrowUp event
    let upEvent = dispatchEventSpy.mock.calls.find(call => call[0] instanceof KeyboardEvent && call[0].key === 'ArrowUp')
    expect(upEvent).toBeTruthy()
    
    dispatchEventSpy.mockRestore()
  })
})
