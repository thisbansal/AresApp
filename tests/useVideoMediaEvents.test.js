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
    vi.useFakeTimers()
  })

  it('initializes with native time when transcodeOffset is 0', () => {
    videoEl.currentTime = 15
    const { result } = renderHook(() => useVideoMediaEvents(videoRef, false, false, false, 0))
    expect(result.current.currentTime).toBe(15)
  })

  it('adds transcodeOffset to initialized time', () => {
    videoEl.currentTime = 15
    const { result } = renderHook(() => useVideoMediaEvents(videoRef, false, false, false, 50000))
    // 15 native + 50 offset = 65
    expect(result.current.currentTime).toBe(65)
  })

  it('updates currentTime with transcodeOffset on timeupdate event', () => {
    const { result } = renderHook(() => useVideoMediaEvents(videoRef, false, false, false, 30000))
    
    act(() => {
      videoEl.currentTime = 10
      videoEl.dispatchEvent(new Event('timeupdate'))
    })
    
    // 10 native + 30 offset
    expect(result.current.currentTime).toBe(40)
  })

  it('does not update local UI time state if user is actively dragging', () => {
    // isDragging = true
    const { result } = renderHook(() => useVideoMediaEvents(videoRef, false, true, false, 30000))
    
    const initialTime = result.current.currentTime
    
    act(() => {
      videoEl.currentTime = 50
      videoEl.dispatchEvent(new Event('timeupdate'))
    })
    
    // Time should remain unchanged because user is dragging
    expect(result.current.currentTime).toBe(initialTime)
  })
})
