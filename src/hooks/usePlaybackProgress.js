import { useEffect, useRef } from 'react'
import { updatePlaybackProgress } from '../services/plex/plexPlaybackService'

/**
 * Custom hook to handle automatic playback resume and progress updates to Plex server.
 * 
 * @param {Object} params Parameters object.
 * @param {Object} params.serverInfo Current server URI and token.
 * @param {string} params.ratingKey Unique rating key for the playing media.
 * @param {React.RefObject} params.videoRef Reference to the HTML5 video element.
 * @param {number} params.viewOffset Last known offset in milliseconds.
 * @param {boolean} params.startOver If true, ignores the saved viewOffset and plays from the start.
 */
export function usePlaybackProgress({ serverInfo, ratingKey, videoRef, viewOffset, startOver }) {
  const progressRef = useRef(0)
  const lastReportedTimeRef = useRef(0)
  const serverInfoRef = useRef(serverInfo)
  const ratingKeyRef = useRef(ratingKey)

  // Sync refs to avoid stale closures in cleanup/event listeners
  useEffect(() => {
    serverInfoRef.current = serverInfo
  }, [serverInfo])

  useEffect(() => {
    ratingKeyRef.current = ratingKey
  }, [ratingKey])

  // Helper to report progress to the Plex server
  const reportProgress = async (timeSeconds, state = 'playing') => {
    const activeServer = serverInfoRef.current
    const activeKey = ratingKeyRef.current
    if (!activeServer || !activeKey) return

    const timeMs = Math.floor(timeSeconds * 1000)
    console.log(`[usePlaybackProgress] Syncing: ${timeMs}ms, state: ${state}`)
    await updatePlaybackProgress(activeServer.uri, activeServer.token, activeKey, timeMs, state)
  }

  // Effect 1: Handle initial resume seeking
  useEffect(() => {
    if (!videoRef.current) return
    const videoEl = videoRef.current

    let startSeconds = 0
    if (!startOver && viewOffset) {
      startSeconds = viewOffset / 1000
    }

    const handleLoadedMetadata = () => {
      if (startSeconds > 0) {
        console.log(`[usePlaybackProgress] Seeking to start timestamp: ${startSeconds}s`)
        videoEl.currentTime = startSeconds
        lastReportedTimeRef.current = startSeconds
        progressRef.current = startSeconds
      }
    }

    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Fallback: If metadata is already loaded before this effect runs
    if (videoEl.readyState >= 1 && startSeconds > 0) {
      console.log(`[usePlaybackProgress] Video readyState >= 1, seeking to start timestamp: ${startSeconds}s`)
      videoEl.currentTime = startSeconds
      lastReportedTimeRef.current = startSeconds
      progressRef.current = startSeconds
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [videoRef, viewOffset, startOver])

  // Effect 2: Handle play, pause, and periodic progress reporting
  useEffect(() => {
    if (!videoRef.current || !ratingKey) return
    const videoEl = videoRef.current

    const handleTimeUpdate = () => {
      const time = videoEl.currentTime
      progressRef.current = time

      // Report progress periodically every 10 seconds of active playback
      if (Math.abs(time - lastReportedTimeRef.current) >= 10) {
        lastReportedTimeRef.current = time
        reportProgress(time, 'playing')
      }
    }

    const handlePlay = () => {
      reportProgress(videoEl.currentTime, 'playing')
    }

    const handlePause = () => {
      reportProgress(videoEl.currentTime, 'stopped')
    }

    videoEl.addEventListener('timeupdate', handleTimeUpdate)
    videoEl.addEventListener('play', handlePlay)
    videoEl.addEventListener('pause', handlePause)

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate)
      videoEl.removeEventListener('play', handlePlay)
      videoEl.removeEventListener('pause', handlePause)
    }
  }, [videoRef, ratingKey])

  // Effect 3: Sync final progress on exit/unmount
  useEffect(() => {
    return () => {
      const finalTime = progressRef.current
      const activeServer = serverInfoRef.current
      const activeKey = ratingKeyRef.current

      if (finalTime > 0 && activeServer && activeKey) {
        const timeMs = Math.floor(finalTime * 1000)
        console.log(`[usePlaybackProgress] Unmount detected, reporting final time: ${timeMs}ms`)
        
        // Build direct URL with token for high-priority fetch keepalive
        const separator = activeServer.uri.includes('?') ? '&' : '?'
        const url = `${activeServer.uri}/:/progress${separator}key=${activeKey}&identifier=com.plexapp.plugins.library&time=${timeMs}&state=stopped&X-Plex-Token=${activeServer.token}`
        
        fetch(url, { method: 'GET', keepalive: true }).catch(err => {
          console.error('[usePlaybackProgress] Failed to send final keepalive progress:', err)
        })
      }
    }
  }, [ratingKey])
}
