// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVideoMediaEvents } from '../src/hooks/useVideoMediaEvents'

describe('useVideoMediaEvents', () => {
  let videoEl
  let videoRef

  beforeEach(() => {
    videoEl = document.createElement('video')
    videoRef = { current: videoEl }
  })

  it('initializes with native time', () => {
    videoEl.currentTime = 50
    const { result } = renderHook(() => useVideoMediaEvents(videoRef, false, false, false))
    expect(result.current.currentTime).toBe(50)
  })

  it('updates currentTime on timeupdate event', () => {
    const { result } = renderHook(() => useVideoMediaEvents(videoRef, false, false, false))
    
    act(() => {
      videoEl.currentTime = 100
      videoEl.dispatchEvent(new Event('timeupdate'))
    })

    expect(result.current.currentTime).toBe(100)
  })

  it('does NOT update currentTime on timeupdate if user is dragging or scrolling', () => {
    // dragging = true, scrolling = false
    const { result } = renderHook(() => useVideoMediaEvents(videoRef, false, true, false))
    
    act(() => {
      videoEl.currentTime = 200
      videoEl.dispatchEvent(new Event('timeupdate'))
    })

    // Should stay at 0
    expect(result.current.currentTime).toBe(0)
  })
})
