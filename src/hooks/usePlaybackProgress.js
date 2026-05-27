import { useEffect, useRef } from 'react'
import { updatePlaybackProgress } from '../services/plex/plexPlaybackService'
import { PLEX_CONFIG } from '../config/app'

/**
 * Custom hook to handle automatic playback resume and periodic progress updates to the Plex server.
 * Ensures the `playQueueItemID` is consistently sent in timeline pings to maintain session states.
 * Also uses `navigator.sendBeacon` for reliable exit syncing, guaranteeing the watch offset 
 * is tracked correctly even if the WebOS TV aggressively closes the application.
 * 
 * @param {Object} params Parameters object.
 * @param {Object} params.serverInfo Current server URI and token.
 * @param {string} params.ratingKey Unique rating key for the playing media.
 * @param {string} params.playQueueItemID The Plex playQueueItemID for the active queue (REQUIRED for tracking).
 * @param {React.RefObject} params.videoRef Reference to the HTML5 video element.
 * @param {number} params.viewOffset Last known offset in milliseconds.
 * @param {boolean} params.startOver If true, ignores the saved viewOffset and plays from the start.
 * @param {boolean} params.isBuffering External state indicating if video is currently buffering.
 * @param {boolean} params.isPlaying External state indicating if video is actively playing.
 * @param {number} params.duration The total duration of the media in milliseconds (from Plex metadata).
 * @param {number} params.transcodeOffset Offset in ms added to video time for transcoded streams.
 */
export function usePlaybackProgress({ serverInfo, ratingKey, playQueueItemID, videoRef, viewOffset, startOver, isBuffering, isPlaying, duration, transcodeOffset = 0 }) {
  const progressRef = useRef(0)
  const lastReportedTimeRef = useRef(0)
  const serverInfoRef = useRef(serverInfo)
  const ratingKeyRef = useRef(ratingKey)
  const playQueueItemIDRef = useRef(playQueueItemID)
  const durationRef = useRef(duration)

  // Sync refs to avoid stale closures in cleanup/event listeners
  useEffect(() => {
    serverInfoRef.current = serverInfo
  }, [serverInfo])

  useEffect(() => {
    ratingKeyRef.current = ratingKey
  }, [ratingKey])

  useEffect(() => {
    playQueueItemIDRef.current = playQueueItemID
  }, [playQueueItemID])

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  // Helper to report progress to the Plex server
  const reportProgress = async (timeSeconds, state = 'playing') => {
    const activeServer = serverInfoRef.current
    const activeKey = ratingKeyRef.current
    const activePlayQueueItemID = playQueueItemIDRef.current
    if (!activeServer || !activeKey || !activePlayQueueItemID) return

    const timeMs = Math.floor(timeSeconds * 1000)
    
    // Ensure durationMs is absolutely never NaN
    let rawVideoDuration = videoRef?.current?.duration
    if (isNaN(rawVideoDuration)) rawVideoDuration = 0
    const durationMs = durationRef.current || Math.floor(rawVideoDuration * 1000) || 1 // Avoid 0

    console.log(`[usePlaybackProgress] Syncing: ${timeMs}ms, duration: ${durationMs}ms, state: ${state}`)
    await updatePlaybackProgress(activeServer.uri, activeServer.token, activeKey, activePlayQueueItemID, timeMs, durationMs, state)
  }

  // Effect 1: Handle initial resume offset via loadedmetadata event
  useEffect(() => {
    if (!videoRef.current || !ratingKey) return
    const videoEl = videoRef.current
    let startSeconds = -1
    if (!startOver && viewOffset > 0 && !transcodeOffset) {
      startSeconds = viewOffset / 1000
    }

    const handleLoadedMetadata = () => {
      if (startSeconds > 0) {
        console.log(`[usePlaybackProgress] Seeking to start timestamp: ${startSeconds}s`)
        videoEl.currentTime = startSeconds
        lastReportedTimeRef.current = startSeconds
        progressRef.current = startSeconds
      } else if (transcodeOffset > 0) {
        lastReportedTimeRef.current = transcodeOffset / 1000
        progressRef.current = transcodeOffset / 1000
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
      const time = videoEl.currentTime + (transcodeOffset / 1000)
      progressRef.current = time

      // Report progress periodically every 10 seconds of active playback
      if (Math.abs(time - lastReportedTimeRef.current) >= 10) {
        lastReportedTimeRef.current = time
        reportProgress(time, 'playing')
      }
    }

    const handlePlay = () => {
      // Don't report play if the video hasn't loaded metadata yet and is at true 0
      if (videoEl.readyState === 0 && !transcodeOffset) return;
      reportProgress(videoEl.currentTime + (transcodeOffset / 1000), 'playing')
    }

    const handlePause = () => {
      reportProgress(videoEl.currentTime + (transcodeOffset / 1000), 'paused')
    }

    const handleWaiting = () => {
      reportProgress(videoEl.currentTime + (transcodeOffset / 1000), 'buffering')
    }

    videoEl.addEventListener('timeupdate', handleTimeUpdate)
    videoEl.addEventListener('play', handlePlay)
    videoEl.addEventListener('pause', handlePause)
    videoEl.addEventListener('waiting', handleWaiting)

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate)
      videoEl.removeEventListener('play', handlePlay)
      videoEl.removeEventListener('pause', handlePause)
      videoEl.removeEventListener('waiting', handleWaiting)
    }
  }, [videoRef, ratingKey, playQueueItemID])

  // Effect 3: Sync final progress on exit/unmount
  useEffect(() => {
    return () => {
      const finalTime = progressRef.current
      const activeServer = serverInfoRef.current
      const activeKey = ratingKeyRef.current
      const activePlayQueueItemID = playQueueItemIDRef.current

      if (finalTime > 0 && activeServer && activeKey && activePlayQueueItemID) {
        const timeMs = Math.floor(finalTime * 1000)
        let rawVideoDuration = videoRef?.current?.duration
        if (isNaN(rawVideoDuration)) rawVideoDuration = 0
        const durationMs = durationRef.current || Math.floor(rawVideoDuration * 1000) || 1

        console.log(`[usePlaybackProgress] Unmount detected, reporting final time: ${timeMs}ms`)
        
        // Build direct URL with token for high-priority fetch keepalive
        const separator = activeServer.uri.includes('?') ? '&' : '?'
        const metadataKey = encodeURIComponent(`/library/metadata/${activeKey}`)
        const url = `${activeServer.uri}/:/timeline${separator}ratingKey=${activeKey}&key=${metadataKey}&identifier=com.plexapp.plugins.library&time=${timeMs}&duration=${durationMs}&state=stopped&playQueueItemID=${activePlayQueueItemID}&X-Plex-Token=${activeServer.token}&X-Plex-Client-Identifier=${PLEX_CONFIG.clientId}`
        
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url)
        } else {
          fetch(url, { method: 'GET', keepalive: true }).catch(err => {
            console.error('[usePlaybackProgress] Failed to send final keepalive progress:', err)
          })
        }
      }
    }
  }, [ratingKey])
}
