import { useState, useEffect } from 'react'

/**
 * Custom hook to abstract all native HTML5 <video> media event listeners.
 * Syncs the native DOM state to React state for the UI to consume.
 * 
 * @param {React.RefObject} videoRef - Reference to the HTML5 video element.
 * @param {boolean} isLoading - Whether the player is currently resolving the stream.
 * @param {boolean} isDragging - Whether the user is actively dragging the timeline track.
 * @param {boolean} isScrolling - Whether the user is actively scrolling the timeline wheel.
 * @param {boolean} isSwitchingStream - Whether the stream is currently switching inline
 * @param {Function} setIsSwitchingStream - State setter to clear the switching state
 * @returns {Object} React state representations of the video properties.
 */
export function useVideoMediaEvents(videoRef, isLoading, isDragging, isScrolling, setIsSwitchingStream) {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)

  // 1. Buffering & Seeking State Observers
  useEffect(() => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return

    const handleWaiting = () => setIsBuffering(true)
    const handlePlaying = () => {
      setIsBuffering(false)
      if (setIsSwitchingStream) setIsSwitchingStream(false)
    }
    const handleCanPlay = () => {
      setIsBuffering(false)
      if (setIsSwitchingStream) setIsSwitchingStream(false)
    }
    const handleSeeking = () => setIsBuffering(true)
    const handleSeeked  = () => setIsBuffering(false)

    videoEl.addEventListener('waiting', handleWaiting)
    videoEl.addEventListener('playing', handlePlaying)
    videoEl.addEventListener('canplay', handleCanPlay)
    videoEl.addEventListener('seeking', handleSeeking)
    videoEl.addEventListener('seeked', handleSeeked)

    return () => {
      videoEl.removeEventListener('waiting', handleWaiting)
      videoEl.removeEventListener('playing', handlePlaying)
      videoEl.removeEventListener('canplay', handleCanPlay)
      videoEl.removeEventListener('seeking', handleSeeking)
      videoEl.removeEventListener('seeked', handleSeeked)
    }
  }, [videoRef, isLoading])

  // 2. Core Playback Observers (Time, Duration, Play/Pause)
  useEffect(() => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return

    const handleTimeUpdate = () => {
      // Do not override local UI time state if user is actively scrubbing
      if (!isDragging && !isScrolling) {
        setCurrentTime(videoEl.currentTime)
      }
    }
    const handleDurationChange = () => setDuration(videoEl.duration || 0)
    const handlePlayState = () => {
      setIsPlaying(true)
      if (setIsSwitchingStream) {
        setIsSwitchingStream(false)
      }
    }
    const handlePauseState = () => setIsPlaying(false)

    videoEl.addEventListener('timeupdate', handleTimeUpdate)
    videoEl.addEventListener('durationchange', handleDurationChange)
    videoEl.addEventListener('play', handlePlayState)
    videoEl.addEventListener('pause', handlePauseState)

    // Sync initial states if video already started loading metadata
    setCurrentTime(videoEl.currentTime || 0)
    setDuration(videoEl.duration || 0)
    setIsPlaying(!videoEl.paused)

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate)
      videoEl.removeEventListener('durationchange', handleDurationChange)
      videoEl.removeEventListener('play', handlePlayState)
      videoEl.removeEventListener('pause', handlePauseState)
    }
  }, [videoRef, isLoading, isDragging, isScrolling])

  return {
    currentTime,
    setCurrentTime, // Exported to allow immediate local UI overrides during scrubbing
    duration,
    isPlaying,
    isBuffering
  }
}
