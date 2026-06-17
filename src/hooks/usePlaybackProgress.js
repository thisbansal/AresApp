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
 * @param {string} params.playbackSessionId Persistent UI playback session UUID.
 * @param {string} params.clientSessionId Persistent client session UUID.
 */
export function usePlaybackProgress({ serverInfo, ratingKey, playQueueItemID, streamUrl, videoRef, viewOffset, startOver, isBuffering, isPlaying, duration, playbackSessionId, clientSessionId }) {
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
    console.log(`[usePlaybackProgress] reportProgress called!`, { timeSeconds, state, activeServer: !!activeServer, activeKey, activePlayQueueItemID })
    if (!activeServer || !activeKey || !activePlayQueueItemID) {
      console.warn(`[usePlaybackProgress] ABORTING TIMELINE SYNC! Missing parameters:`, { activeServer: !!activeServer, activeKey: !!activeKey, activePlayQueueItemID })
      return
    }

    const timeMs = Math.floor(timeSeconds * 1000)
    
    // Ensure durationMs is absolutely never NaN
    let rawVideoDuration = videoRef?.current?.duration
    if (isNaN(rawVideoDuration)) rawVideoDuration = 0
    let durationMs = durationRef.current || Math.floor(rawVideoDuration * 1000) || 1 // Avoid 0
    if (!isFinite(durationMs)) durationMs = durationRef.current || 1

    console.log(`[usePlaybackProgress] PRE-SYNC CHECK: timeMs=${timeMs}, durationMs=${durationMs}, state=${state}`)
    try {
      await updatePlaybackProgress(activeServer.uri, activeServer.token, activeKey, activePlayQueueItemID, timeMs, durationMs, state, playbackSessionId, clientSessionId)
      console.log(`[usePlaybackProgress] SUCCESS! Timeline synced!`)
    } catch (e) {
      console.error(`[usePlaybackProgress] ERROR syncing timeline:`, e)
    }
  }

  // Effect 1: Handle initial resume offset via loadedmetadata event
  useEffect(() => {
    if (!videoRef.current || !ratingKey) return
    const videoEl = videoRef.current
    let startSeconds = -1
    if (!startOver && viewOffset > 0) {
      startSeconds = viewOffset / 1000
    }

    const isDash = streamUrl && streamUrl.includes('protocol=dash');

    const handleLoadedMetadata = () => {
      if (startSeconds > 0) {
        if (isDash) {
          console.log(`[usePlaybackProgress] Stream is DASH. Bypassing manual seek to let Shaka Player handle the manifest timeline. (current is ${videoEl.currentTime})`);
          progressRef.current = videoEl.currentTime;
        } else if (Math.abs(videoEl.currentTime - startSeconds) > 2) {
          console.log(`[usePlaybackProgress] Seeking to start timestamp: ${startSeconds}s (current is ${videoEl.currentTime})`);
          videoEl.currentTime = startSeconds;
          progressRef.current = startSeconds;
        } else {
          console.log(`[usePlaybackProgress] Already at start timestamp: ${startSeconds}s`);
        }
      }
    }

    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Fallback: If metadata is already loaded before this effect runs
    if (videoEl.readyState >= 1 && startSeconds > 0) {
      if (isDash) {
        console.log(`[usePlaybackProgress] Stream is DASH (readyState >= 1). Bypassing manual seek.`);
      } else if (Math.abs(videoEl.currentTime - startSeconds) > 2) {
        console.log(`[usePlaybackProgress] Video readyState >= 1, seeking to start timestamp: ${startSeconds}s`);
        videoEl.currentTime = startSeconds;
        progressRef.current = startSeconds;
      }
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [videoRef.current, viewOffset, startOver, streamUrl])

  // Effect 2: Handle play, pause, and periodic progress reporting
  useEffect(() => {
    if (!videoRef.current || !ratingKey) return
    const videoEl = videoRef.current

    const handleTimeUpdate = () => {
      if (videoEl.readyState === 0) return;
      const time = videoEl.currentTime;
      
      const isDash = streamUrl && streamUrl.includes('protocol=dash');
      const startSeconds = (!startOver && viewOffset > 0) ? (viewOffset / 1000) : 0;
      const trueTime = isDash ? time + startSeconds : time;
      
      progressRef.current = trueTime;

      // Report progress periodically every 10 seconds of active playback
      if (Math.abs(trueTime - lastReportedTimeRef.current) >= 10) {
        console.log(`[usePlaybackProgress] handleTimeUpdate crossed 10s threshold! trueTime=${trueTime}`)
        lastReportedTimeRef.current = trueTime
        reportProgress(trueTime, 'playing')
      }
    }

    const getTrueTime = () => {
      const isDash = streamUrl && streamUrl.includes('protocol=dash');
      const startSeconds = (!startOver && viewOffset > 0) ? (viewOffset / 1000) : 0;
      return isDash ? videoEl.currentTime + startSeconds : videoEl.currentTime;
    };

    const handlePlay = (e) => {
      console.log(`[usePlaybackProgress] Event: ${e.type}, readyState: ${videoEl.readyState}, time: ${videoEl.currentTime}`)
      if (videoEl.readyState === 0) return;
      reportProgress(getTrueTime(), 'playing')
    }

    const handlePause = (e) => {
      console.log(`[usePlaybackProgress] Event: ${e.type}, readyState: ${videoEl.readyState}, time: ${videoEl.currentTime}`)
      if (videoEl.readyState === 0) return;
      reportProgress(getTrueTime(), 'paused')
    }

    const handleWaiting = (e) => {
      console.log(`[usePlaybackProgress] Event: ${e.type}, readyState: ${videoEl.readyState}, time: ${videoEl.currentTime}`)
      if (videoEl.readyState === 0) return;
      reportProgress(getTrueTime(), 'buffering')
    }

    videoEl.addEventListener('timeupdate', handleTimeUpdate)
    videoEl.addEventListener('play', handlePlay)
    videoEl.addEventListener('playing', handlePlay)
    videoEl.addEventListener('pause', handlePause)
    videoEl.addEventListener('waiting', handleWaiting)

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate)
      videoEl.removeEventListener('play', handlePlay)
      videoEl.removeEventListener('playing', handlePlay)
      videoEl.removeEventListener('pause', handlePause)
      videoEl.removeEventListener('waiting', handleWaiting)
    }
  }, [videoRef.current, ratingKey, playQueueItemID, streamUrl])

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
        let durationMs = durationRef.current || Math.floor(rawVideoDuration * 1000) || 1
        if (!isFinite(durationMs)) durationMs = durationRef.current || 1

        console.log(`[usePlaybackProgress] Unmount detected, reporting final time: ${timeMs}ms`)
        
        // Build direct URL with token for high-priority fetch keepalive
        const separator = activeServer.uri.includes('?') ? '&' : '?'
        const metadataKey = encodeURIComponent(`/library/metadata/${activeKey}`)
        const url = `${activeServer.uri}/:/timeline${separator}ratingKey=${activeKey}&key=${metadataKey}&identifier=com.plexapp.plugins.library&time=${timeMs}&duration=${durationMs}&state=stopped&playQueueItemID=${activePlayQueueItemID}&X-Plex-Token=${activeServer.token}&X-Plex-Client-Identifier=${PLEX_CONFIG.clientId}&X-Plex-Session-Id=${clientSessionId}&X-Plex-Playback-Session-Id=${playbackSessionId}&X-Plex-Playback-Id=${playbackSessionId}`
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
