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
export function useVideoMediaEvents(videoRef, isLoading, isDragging, isScrolling, isSwitchingStream, setIsSwitchingStream) {
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
    }
    const handleCanPlay = () => {
      setIsBuffering(false)
      if (setIsSwitchingStream) setIsSwitchingStream(false)
    }
    const handleSeeking = () => setIsBuffering(true)
    const handleSeeked  = () => setIsBuffering(false)
    const handleLoadStart = () => setIsBuffering(true)
    const handlePause = () => setIsBuffering(false)

    videoEl.addEventListener('waiting', handleWaiting)
    videoEl.addEventListener('playing', handlePlaying)
    videoEl.addEventListener('canplay', handleCanPlay)
    videoEl.addEventListener('seeking', handleSeeking)
    videoEl.addEventListener('seeked', handleSeeked)
    videoEl.addEventListener('loadstart', handleLoadStart)
    videoEl.addEventListener('pause', handlePause)

    return () => {
      videoEl.removeEventListener('waiting', handleWaiting)
      videoEl.removeEventListener('playing', handlePlaying)
      videoEl.removeEventListener('canplay', handleCanPlay)
      videoEl.removeEventListener('seeking', handleSeeking)
      videoEl.removeEventListener('seeked', handleSeeked)
      videoEl.removeEventListener('loadstart', handleLoadStart)
      videoEl.removeEventListener('pause', handlePause)
    }
  }, [videoRef, isLoading])

  // 2. Core Playback Observers (Time, Duration, Play/Pause)
  useEffect(() => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return

    const handleTimeUpdate = () => {
      // Do not override local UI time state if user is actively scrubbing or stream is switching
      if (!isDragging && !isScrolling && !isSwitchingStream) {
        setCurrentTime(videoEl.currentTime)
      }
    }
    const handleDurationChange = () => setDuration(videoEl.duration || 0)
    const handlePlayState = () => {
      setIsPlaying(true)
    }
    const handlePauseState = () => setIsPlaying(false)
    const handleLoadedMetadata = () => {
      console.log('[NativeVideo] loadedmetadata fired. Inspecting embedded tracks:')
      if (videoEl.audioTracks) {
        console.log(`[NativeVideo] audioTracks count: ${videoEl.audioTracks.length}`)
        for (let i = 0; i < videoEl.audioTracks.length; i++) {
          console.log(`[NativeVideo] Audio Track ${i}:`, videoEl.audioTracks[i])
        }
      } else {
        console.log('[NativeVideo] HTML5 audioTracks API not exposed/supported on this platform.')
      }

      if (videoEl.videoTracks) {
        console.log(`[NativeVideo] videoTracks count: ${videoEl.videoTracks.length}`)
        for (let i = 0; i < videoEl.videoTracks.length; i++) {
          console.log(`[NativeVideo] Video Track ${i}:`, videoEl.videoTracks[i])
        }
      }

      if (videoEl.textTracks) {
        console.log(`[NativeVideo] textTracks count: ${videoEl.textTracks.length}`)
        for (let i = 0; i < videoEl.textTracks.length; i++) {
          console.log(`[NativeVideo] Text Track ${i}:`, videoEl.textTracks[i])
        }
      }
    }

    videoEl.addEventListener('timeupdate', handleTimeUpdate)
    videoEl.addEventListener('durationchange', handleDurationChange)
    videoEl.addEventListener('play', handlePlayState)
    videoEl.addEventListener('pause', handlePauseState)
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Sync initial states if video already started loading metadata, but protect UI during switches
    if (!isSwitchingStream || videoEl.readyState >= 3) {
      setCurrentTime(videoEl.currentTime || 0)
      if (isSwitchingStream && setIsSwitchingStream) {
        setIsSwitchingStream(false)
      }
    }
    setDuration(videoEl.duration || 0)
    setIsPlaying(!videoEl.paused)
    setIsBuffering(videoEl.readyState < 3 && !videoEl.paused)

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate)
      videoEl.removeEventListener('durationchange', handleDurationChange)
      videoEl.removeEventListener('play', handlePlayState)
      videoEl.removeEventListener('pause', handlePauseState)
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [videoRef, isLoading, isDragging, isScrolling, isSwitchingStream])

  return {
    currentTime,
    setCurrentTime, // Exported to allow immediate local UI overrides during scrubbing
    duration,
    isPlaying,
    isBuffering
  }
}
