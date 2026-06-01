import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMetadata } from '../services/plex/plexContentService'
import { createPlayQueue, setStreamSelection } from '../services/plex/plexPlaybackService'
import { useActiveServer } from '../hooks/useActiveServer'
import { useNotificationStore } from '../services/notifications/notificationStore'
import { subtitleConverter } from '../utils/subtitleConverter'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { usePlaybackProgress } from '../hooks/usePlaybackProgress'

import { PLEX_CONFIG } from '../config/app'
import { usePlayerHUD } from '../hooks/usePlayerHUD'
import { useVideoMediaEvents } from '../hooks/useVideoMediaEvents'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { formatTime, formatRemainingTime } from '../utils/timeUtils'
import { plexStreamBuilder } from '../services/plex/plexStreamBuilder'
import { SubtitleManagerFactory } from '../services/plex/subtitles/SubtitleManagerFactory'
import SubtitleOverlay from '../components/media/SubtitleOverlay'
import { mediaCodecService } from '../services/MediaCodecService'
import shaka from 'shaka-player'
import '../style.css'

export default function PlayerPage() {
  const { serverId, ratingKey } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const videoRef = useRef(null)
  const subtitleOverlayRef = useRef(null)
  const shakaRef = useRef(null)
  const [metaDetails, setMetaDetails] = useState({ title: '', subtitle: '', viewOffset: 0 })
  const [loading, setLoading] = useState(true)
  const [isSubtitleCaching, setIsSubtitleCaching] = useState(false)
  const [isSwitchingStream, setIsSwitchingStream] = useState(false)
  const [streamUrl, setStreamUrl] = useState('')
  const [isShakaReady, setIsShakaReady] = useState(false)
  const [playQueueItemID, setPlayQueueItemID] = useState(null)
  const [serverInfo, serverLoading] = useActiveServer(location.state?.serverInfo, navigate)
  const [availableStreams, setAvailableStreams] = useState([])
  const [numberOfStreams, setNumberOfStreams] = useState({ video: 1, audio: 1, subtitles: 0 })
  const [partId, setPartId] = useState(null)
  const [partKey, setPartKey] = useState(null)
  const [forceSubtitleBurnIn, setForceSubtitleBurnIn] = useState(false)
  const [activeMenu, setActiveMenu] = useState('none') // 'none', 'subtitle', 'audio', 'video'
  const [dragTime, setDragTime] = useState(0)
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true)

  // HUD Visibility & Interaction State
  const [isDragging, setIsDragging] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const seekTimeoutRef = useRef(null)
  const lastStreamUrlRef = useRef(null)
  const lastDragEndTimeRef = useRef(0)

  // Generate persistent UI session IDs for timeline tracking and transcode termination
  const { playbackSessionId, clientSessionId } = useMemo(() => ({
    playbackSessionId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    clientSessionId: Math.random().toString(36).substring(2, 15)
  }), [])

  const { showHUD, setShowHUD, triggerHUD, hudTimeoutRef, hudLockoutRef } = usePlayerHUD(loading, isDragging, isScrolling)
  const { currentTime, setCurrentTime, duration: videoDuration, isPlaying, isBuffering } = useVideoMediaEvents(
    videoRef, loading, isDragging, isScrolling, isSwitchingStream, setIsSwitchingStream
  )

  const duration = metaDetails?.duration ? metaDetails.duration / 1000 : videoDuration

  usePlayerControls({
    videoRef,
    navigate,
    duration,
    showHUD,
    setShowHUD,
    triggerHUD,
    isDragging,
    isScrolling,
    setIsScrolling,
    currentTime,
    setCurrentTime,
    seekTimeoutRef,
    hudTimeoutRef,
    hudLockoutRef,
    executeSeek,
    activeMenu,
    setActiveMenu
  })



  usePlaybackProgress({
    serverInfo,
    ratingKey,
    playQueueItemID,
    streamUrl,
    videoRef,
    viewOffset: metaDetails?.viewOffset || 0,
    startOver: location.state?.startOver,
    isBuffering,
    isPlaying,
    duration: metaDetails?.duration || 0,
    playbackSessionId,
    clientSessionId
  })

  useEffect(() => {
    if (serverLoading || !serverInfo) return

    const fetchStreamDetails = async () => {
      setLoading(true)
      try {
        const metadata = await getMetadata(serverInfo.uri, serverInfo.token, ratingKey)
        const queueData = await createPlayQueue(serverInfo.uri, serverInfo.token, ratingKey)
        if (!queueData || !queueData.playQueueSelectedItemID) {
          throw new Error('Failed to establish Plex play session')
        }
        setPlayQueueItemID(queueData.playQueueSelectedItemID)

        const sub = metadata.grandparentTitle
          ? `${metadata.grandparentTitle} • ${metadata.parentTitle} • Episode ${metadata.index}`
          : metadata.year || ''

        setMetaDetails({
          title: metadata.title,
          subtitle: sub,
          viewOffset: metadata.viewOffset,
          duration: metadata.duration
        })

        // Find direct stream key from metadata
        const part = metadata.media?.[0]?.parts?.[0]
        if (!part || !part.key) {
          throw new Error('No playable stream file found for this item.')
        }

        setPartId(part.id)
        setPartKey(part.key)

        // Ensure at least one stream is selected per type for UI highlighting
        let streams = part.streams || []
        ;[1, 2].forEach(type => {
          const typeStreams = streams.filter(s => s.streamType === type)
          if (typeStreams.length > 0 && !typeStreams.some(s => s.selected)) {
            const defaultStream = typeStreams.find(s => s.default) || typeStreams[0]
            if (defaultStream) defaultStream.selected = true
          }
        })

        // Auto-select English text subtitle for background streaming if none is selected
        const subtitleStreams = streams.filter(s => s.streamType === 3)
        const isAnySubtitleSelected = subtitleStreams.some(s => s.selected)
        
        if (!isAnySubtitleSelected && subtitleStreams.length > 0) {
          const bestEnglishTextSub = subtitleStreams.find(s => 
            (s.languageCode === 'eng' || s.language === 'English' || s.languageCode === 'en') &&
            (s.codec === 'srt' || s.codec === 'vtt' || s.codec === 'ass' || s.codec === 'ssa')
          )
          if (bestEnglishTextSub) {
            console.log(`[PlayerPage] Auto-selecting English subtitle: ${bestEnglishTextSub.id} for background streaming`);
            bestEnglishTextSub.selected = true;
            setIsSubtitleVisible(false); // Hidden by default
            setStreamSelection(serverInfo.uri, serverInfo.token, part.id, '', bestEnglishTextSub.id).catch(console.error)
          } else {
            setIsSubtitleVisible(false);
          }
        } else if (!isAnySubtitleSelected) {
          setIsSubtitleVisible(false);
        }

        setAvailableStreams(streams)

        const structuredStreams = {
          video: streams.filter(s => s.streamType === 1),
          audio: streams.filter(s => s.streamType === 2),
          subtitles: streams.filter(s => s.streamType === 3),
        }

        const capabilities = mediaCodecService.checkStreamCapabilities(structuredStreams)
        const optimalUrl = await plexStreamBuilder.getOptimalStreamUrl(
          serverInfo,
          part,
          ratingKey,
          capabilities,
          playbackSessionId,
          clientSessionId,
          location.state?.startOver ? 0 : (metadata.viewOffset || 0)
        )

        console.log(`[PlayerPage] Initial Optimal Stream URL: ${optimalUrl}`)
        setStreamUrl(optimalUrl)
      } catch (err) {
        console.error('[PlayerPage] Playback startup failure:', err)
        useNotificationStore.getState().addNotification(`Playback error: ${err.message}`, { level: 'error' })
        navigate(-1)
      } finally {
        setLoading(false)
      }
    }

    fetchStreamDetails()
  }, [ratingKey, serverInfo, serverLoading, navigate])

  useEffect(() => {
    if (!streamUrl) return

    setIsShakaReady(false)

    let isCancelled = false
    let fallbackTimeout = null
    const activeVideo = availableStreams.find(s => s.streamType === 1 && s.selected) || availableStreams.find(s => s.streamType === 1);
    const activeAudio = availableStreams.find(s => s.streamType === 2 && s.selected) || availableStreams.find(s => s.streamType === 2);

    console.log(`
      =====================================
      STREAM DIAGNOSTICS:
      URL: ${streamUrl}
      -------------------------------------
      Selected Video: ${activeVideo?.codec || 'Unknown'} (${activeVideo?.displayTitle || 'Unknown'})
      Selected Audio: ${activeAudio?.codec || 'Unknown'} (${activeAudio?.displayTitle || 'Unknown'})
      Color Space: ${activeVideo?.colorSpace || 'Unknown'}
      Color Trc: ${activeVideo?.colorTrc || 'Unknown'}
      Dolby Vision (DoVi): ${activeVideo?.codec === 'dovi' || activeVideo?.doviProfile ? 'YES' : 'NO'}
      HDR10: ${activeVideo?.colorSpace?.includes('bt2020') && activeVideo?.colorTrc === 'smpte2084' ? 'YES' : 'NO'}
      =====================================
    `);

    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return

    // Clean up previous Shaka instance if one exists
    if (shakaRef.current) {
      shakaRef.current.destroy()
      shakaRef.current = null
    }

    // Safely flush the TV's hardware decoder pipeline before injecting a new format.
    videoEl.src = ''
    videoEl.removeAttribute('src')

    // Initialize Shaka Player
    shaka.polyfill.installAll()
    let initShaka;

    if (shaka.Player.isBrowserSupported()) {
      let initialized = false
      initShaka = async () => {
        if (isCancelled) return
        if (initialized) return
        initialized = true
        videoEl.removeEventListener('emptied', initShaka)
        if (fallbackTimeout) clearTimeout(fallbackTimeout)

        const player = new shaka.Player();
        await player.attach(videoEl);
        shakaRef.current = player;

        // Inject Plex authentication headers/query params into all Shaka requests
        player.getNetworkingEngine().registerRequestFilter((type, request) => {
          // Append X-Plex-Token to the URL for segment requests
          const url = new URL(request.uris[0]);
          if (!url.searchParams.has('X-Plex-Token')) {
            url.searchParams.set('X-Plex-Token', serverInfo.token);
            request.uris[0] = url.toString();
          }
        });

        // Shaka configuration
        player.configure({
          manifest: {
            dash: {
              ignoreMinBufferTime: true, // Tolerate dynamic transcode timing quirks
            }
          },
          streaming: {
            bufferingGoal: 30, // Only keep 30 seconds of video buffered ahead
            rebufferingGoal: 2, // Resume playback after 2 seconds of buffer
            bufferBehind: 30, // Keep 30 seconds in the past
            lowLatencyMode: false, // Disabling this prevents the aggressive "catch-up" segment flooding
          }
        })

        // Listen for errors
        player.addEventListener('error', (event) => {
          if (isCancelled) return;
          console.error('[Shaka] Error code', event.detail.code, 'object', event.detail)
          try {
            console.error('[Shaka] Error details JSON:', JSON.stringify(event.detail, Object.getOwnPropertyNames(event.detail), 2));
          } catch(e) {}
          if (event.detail.severity === shaka.util.Error.Severity.CRITICAL) {
             console.error('[Shaka] Fatal playback error, giving up')
          }
        })

        // Add robust debugging logs
        player.addEventListener('buffering', (event) => {
          if (isCancelled) return;
          console.log('[Shaka] Buffering state changed:', event.buffering);
          if (event.buffering) {
            console.log('[Shaka] Current buffer info:', player.getBufferedInfo());
          }
        });

        player.addEventListener('trackschanged', () => {
          if (isCancelled) return;
          console.log('[Shaka] Tracks changed. Available tracks:', player.getVariantTracks());
        });

        player.addEventListener('adaptation', () => {
          if (isCancelled) return;
          const activeTrack = player.getVariantTracks().find(t => t.active);
          console.log('[Shaka] Adaptation event triggered. Active track:', activeTrack);
        });

        try {
          console.log(`[Shaka] Loading DASH/Media URL: ${streamUrl}`)
          await player.load(streamUrl)
          if (isCancelled) return;
          console.log('[Shaka] The video has now been loaded successfully!')
          setIsShakaReady(true)

          // Print out all text tracks for debugging
          const tracks = player.getTextTracks()
          console.log(`[Shaka] Found ${tracks.length} text tracks embedded in the DASH manifest.`, tracks)

          videoEl.play().catch(e => console.error('[PlayerPage] Autoplay blocked or failed:', e))
        } catch (e) {
          if (isCancelled) return;
          if (e && e.code !== shaka?.util?.Error?.Code?.LOAD_INTERRUPTED) {
            console.error('[Shaka] CRITICAL LOAD ERROR:', e.code, e.message);
            console.error('[Shaka] Full Error Object:', e);
            try {
              console.error('[Shaka] Error details JSON:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
            } catch(err) {}
          }
        }
      }

      // If the video is already empty, initialize immediately. Otherwise wait for the flush to complete.
      if (videoEl.readyState === 0 && !videoEl.currentSrc) {
        initShaka()
      } else {
        videoEl.addEventListener('emptied', initShaka)
        fallbackTimeout = setTimeout(initShaka, 500) // Fallback just in case 'emptied' doesn't fire
      }
      videoEl.load() // Trigger the flush
    } else {
      console.error('[Shaka] Browser not supported!')
      // Pure direct play or raw native loading fallback
      videoEl.src = streamUrl
      videoEl.load()

      const playOnCanPlay = () => {
        if (isCancelled) return;
        videoEl.play().catch(e => console.error('[PlayerPage] Autoplay blocked or failed:', e))
        videoEl.removeEventListener('canplay', playOnCanPlay)
      }
      videoEl.addEventListener('canplay', playOnCanPlay)
    }

    return () => {
      isCancelled = true
      if (fallbackTimeout) clearTimeout(fallbackTimeout)
      if (initShaka) videoEl.removeEventListener('emptied', initShaka)

      if (shakaRef.current) {
        shakaRef.current.destroy()
        shakaRef.current = null
      }
    }
  }, [streamUrl])

  useEffect (() => {
    const streams = {
      video: availableStreams.filter(s => s.streamType === 1),
      audio: availableStreams.filter(s => s.streamType === 2),
      subtitles: availableStreams.filter(s => s.streamType === 3),
    };

    setNumberOfStreams(streams);
  }, [availableStreams])

  useEffect (() => {
    console.log(numberOfStreams)
  }, [numberOfStreams])

  async function executeSeek(newGlobalTime) {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return false

    if (streamUrl?.includes('transcode')) {
      const buffered = videoEl.buffered
      const isDash = streamUrl.includes('protocol=dash')
      const startSeconds = (!location.state?.startOver && metaDetails?.viewOffset > 0) ? (metaDetails.viewOffset / 1000) : 0

      const normalizedTarget = isDash ? newGlobalTime - startSeconds : newGlobalTime

      let isBuffered = false
      for (let i = 0; i < buffered.length; i++) {
        if (normalizedTarget >= buffered.start(i) && normalizedTarget <= buffered.end(i) + 5) {
          isBuffered = true
          break
        }
      }

      if (!isBuffered) {
        setMetaDetails(prev => ({ ...prev, viewOffset: newGlobalTime * 1000 }))
        if (!videoEl.paused) videoEl.pause()
        setIsSwitchingStream(true)

        const structuredStreams = {
          video: availableStreams.filter(s => s.streamType === 1),
          audio: availableStreams.filter(s => s.streamType === 2),
          subtitles: availableStreams.filter(s => s.streamType === 3),
        }

        let newUrl = await plexStreamBuilder.getOptimalStreamUrl(
          serverInfo,
          { key: partKey },
          ratingKey,
          mediaCodecService.checkStreamCapabilities(structuredStreams),
          playbackSessionId,
          clientSessionId,
          newGlobalTime * 1000
        )
        newUrl += `#t=${Date.now()}`
        setStreamUrl(newUrl)
        return true
      }

      videoEl.currentTime = normalizedTarget
      return false
    } else {
      setMetaDetails(prev => ({ ...prev, viewOffset: newGlobalTime * 1000 }))
      videoEl.currentTime = newGlobalTime
      return false
    }
  }

  // Native HTTP Sidecar Subtitle Engine
  useEffect(() => {
    const activeSubtitle = availableStreams.find(s => s.streamType === 3 && s.selected)
    const videoEl = videoRef.current

    // Wait for the streamUrl to be fully resolved before starting subtitles, 
    // otherwise Plex locks the transcode session at offset 0!
    if (!activeSubtitle || !serverInfo || !videoEl || !streamUrl) return

    const isDash = streamUrl && streamUrl.includes('protocol=dash');
    const isHls = streamUrl && streamUrl.includes('protocol=hls');
    const startSeconds = (!location.state?.startOver && metaDetails?.viewOffset > 0) ? (metaDetails.viewOffset / 1000) : 0;
    
    // Detect if this effect is running because the video URL changed (e.g. initial mount or unbuffered seek).
    // If it did, Shaka hasn't reset videoEl.currentTime yet, meaning videoEl.currentTime holds the STALE time
    // of the previous stream. In this case, we MUST only use startSeconds as the offset.
    const isNewStream = lastStreamUrlRef.current !== streamUrl;
    lastStreamUrlRef.current = streamUrl;

    // Calculate the TRUE absolute movie time to pass to the Plex Subtitle Transcoder
    const initialAbsoluteStartTime = isNewStream 
      ? startSeconds 
      : (isDash || isHls) 
        ? videoEl.currentTime + startSeconds 
        : Math.max(videoEl.currentTime, startSeconds);

    // If it's a DASH stream, we MUST wait for Shaka to fully load before attaching the native handler
    if (isDash && !isShakaReady) return;

    // The factory encapsulates all codec-checking and instantiates the correct pure logic handler
    const subtitleManager = SubtitleManagerFactory.createHandler(activeSubtitle, isDash, shakaRef, videoRef, () => {
      // Because we set copyts=1, the Plex Transcoder outputs subtitles with their true absolute movie timestamps!
      // For Direct Play, videoEl.currentTime is the absolute time.
      // For DASH/HLS transcodes, videoEl.currentTime starts at 0, so we MUST add startSeconds!
      return (isDash || isHls) ? videoEl.currentTime + startSeconds : videoEl.currentTime;
    }, subtitleOverlayRef, setIsSubtitleCaching)

    if (!subtitleManager) return

    let activeSidecarSessionId = null;

    if (isDash) {
      console.log('[Native Subtitles] DASH Stream detected. Using in-band subtitle parser (no sidecar).')
      subtitleManager.start()
    } else {
      // Create a completely isolated session UUID for the Sidecar Transcoder.
      // This prevents Plex from throwing '400 Bad Request' (Session already exists) 
      // if the user rapidly toggles the subtitles off and on.
      activeSidecarSessionId = `${playbackSessionId}-sub-${Date.now()}`;

      const sidecarUrl = plexStreamBuilder.buildOfficialSidecarUrl(
        serverInfo,
        ratingKey,
        activeSidecarSessionId,
        initialAbsoluteStartTime * 1000
      )
      
      if (!sidecarUrl) return

      // First, ping the /decision endpoint to initialize the background transcode session
      plexStreamBuilder.pingSidecarDecision(serverInfo, ratingKey, activeSidecarSessionId, initialAbsoluteStartTime * 1000)
        .then(success => {
          if (!success) throw new Error('Failed to initialize sidecar transcode session')
          
          console.log(`[Native Subtitles] Session initialized! Starting custom streaming parser for URL: ${sidecarUrl}`)
          subtitleManager.start(sidecarUrl)
        })
        .catch(err => {
          console.error('[Native Subtitles] Failed to initialize or attach sidecar subtitle:', err)
        })
    }

    return () => {
      subtitleManager.destroy()
      if (activeSidecarSessionId) {
        // Explicitly kill the zombie transcoder session on the Plex server!
        // Plex limits active transcode slots per client. If we just abort the socket, it stays alive.
        plexStreamBuilder.stopSidecarSession(serverInfo, activeSidecarSessionId);
      }
    }
  }, [availableStreams, serverInfo, ratingKey, playbackSessionId, streamUrl, metaDetails, location.state, isShakaReady])

  // Drag Seek Pointer Move and Pointer Up Observers
  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e) => {
      triggerHUD()
      const trackEl = document.querySelector('.timeline-track')
      if (!trackEl) return

      const rect = trackEl.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      const newTime = percentage * duration
      setDragTime(newTime) // Only visually update the UI during drag
    }

    const handlePointerUp = async (e) => {
      // Calculate final time based on where the pointer was released
      let finalTime = 0
      const trackEl = document.querySelector('.timeline-track')
      if (trackEl) {
        const rect = trackEl.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, clickX / rect.width))
        finalTime = percentage * duration
        setDragTime(finalTime)
      }

      const streamChanged = await executeSeek(finalTime)

      const videoEl = videoRef.current || document.querySelector('video')
      // Only explicitly play if we didn't initiate a stream switch. 
      // If the stream switched, the new VideoLayer will remount and autoplay.
      if (videoEl && !streamChanged) {
        videoEl.play().catch(err => console.error('Play after drag failed:', err))
      }
      setIsDragging(false)
      lastDragEndTimeRef.current = Date.now()
      // Restart HUD hide timer on release
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
      hudTimeoutRef.current = setTimeout(() => {
        setShowHUD(false)
      }, 4000)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, duration, triggerHUD, setShowHUD, hudTimeoutRef])

  const handlePlayPauseClick = () => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return
    triggerHUD()
    if (videoEl.paused) {
      videoEl.play().catch(err => console.error(err))
    } else {
      videoEl.pause()
    }
  }

  const handleRestartClick = async () => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return
    triggerHUD()
    setCurrentTime(0)
    setDragTime(0)
    await executeSeek(0)
    videoEl.play().catch(err => console.error('Restart play failed:', err))
    useNotificationStore.getState().addNotification('Restarted from beginning', { level: 'info' })
  }

  const handleSeek = (direction) => {
    triggerHUD()
    const isDash = streamUrl && streamUrl.includes('protocol=dash')
    const startSeconds = (!location.state?.startOver && metaDetails?.viewOffset > 0) ? (metaDetails.viewOffset / 1000) : 0
    const displayTime = isDragging ? dragTime : (isDash ? currentTime + startSeconds : currentTime)

    if (direction === 'back') {
      executeSeek(Math.max(0, displayTime - 10))
    } else {
      executeSeek(Math.min(duration || 0, displayTime + 10))
    }
  }

  const handleTimelinePointerDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    triggerHUD()

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = percentage * duration

    const videoEl = videoRef.current || document.querySelector('video')
    if (videoEl && !videoEl.paused) {
      videoEl.pause()
    }
    setDragTime(newTime)
  }

  const handleStreamSelect = async (streamType, streamId) => {
    if (!partId || !partKey) return
    triggerHUD()
    const videoEl = videoRef.current || document.querySelector('video')

    const isDash = streamUrl && streamUrl.includes('protocol=dash')
    const startSeconds = (!location.state?.startOver && metaDetails?.viewOffset > 0) ? (metaDetails.viewOffset / 1000) : 0
    const displayTime = isDragging ? dragTime : (isDash ? currentTime + startSeconds : currentTime)
    const globalTime = displayTime // Use global time to correctly factor in transcode offsets

    let audioId = ''
    let subtitleId = ''

    if (streamType === 3) subtitleId = streamId
    if (streamType === 2) audioId = streamId

    setAvailableStreams(prev => prev.map(s => {
      if (s.streamType === streamType) {
        return { ...s, selected: s.id === streamId }
      }
      return s
    }))

    setActiveMenu('none')

    if (streamType === 1) return // Video stream selection is informational or handled differently

    // Pre-calculate capabilities to ensure the TV actually supports the requested stream before trusting native switching
    const updatedStreams = availableStreams.map(s => {
      if (s.streamType === streamType) return { ...s, selected: s.id === streamId }
      return s
    })

    const structuredStreams = {
      video: updatedStreams.filter(s => s.streamType === 1),
      audio: updatedStreams.filter(s => s.streamType === 2),
      subtitles: updatedStreams.filter(s => s.streamType === 3),
    }
    const capabilities = mediaCodecService.checkStreamCapabilities(structuredStreams)

    // Optional manual parameter to force burn in (arguments[7])
    const newStreamUrl = await plexStreamBuilder.getOptimalStreamUrl(
      serverInfo, { id: partId, key: partKey }, ratingKey, capabilities, playbackSessionId, clientSessionId,
      (videoEl ? videoEl.currentTime * 1000 : 0),
      forceSubtitleBurnIn
    )

    // Try native HTML5 track switching first (Instant, no reload)
    let switchedNatively = false
    try {
      if (streamType === 2 && videoEl && videoEl.audioTracks && videoEl.audioTracks.length > 0) {
        // Only attempt native switch if the TV hardware ACTUALLY supports the codec
        const targetAudioCapability = capabilities.audio.find(a => a.id === streamId)
        if (targetAudioCapability && targetAudioCapability.supported) {
          const audioStreams = availableStreams.filter(s => s.streamType === 2)
          const trackIndex = audioStreams.findIndex(s => s.id === streamId)
          if (trackIndex !== -1 && trackIndex < videoEl.audioTracks.length) {
            for (let i = 0; i < videoEl.audioTracks.length; i++) {
              videoEl.audioTracks[i].enabled = (i === trackIndex)
            }
            switchedNatively = true
          }
        } else {
          console.log(`[PlayerPage] Bypassing native audio switch because codec is unsupported by HW:`, targetAudioCapability?.codec)
        }
      }
      if (streamType === 3 && videoEl && videoEl.textTracks && videoEl.textTracks.length > 0) {
        const subtitleStreams = availableStreams.filter(s => s.streamType === 3)
        const trackIndex = streamId === 0 ? -1 : subtitleStreams.findIndex(s => s.id === streamId)
        if (streamId === 0 || (trackIndex !== -1 && trackIndex < videoEl.textTracks.length)) {
          for (let i = 0; i < videoEl.textTracks.length; i++) {
            videoEl.textTracks[i].mode = (i === trackIndex) ? 'showing' : 'disabled'
          }
          switchedNatively = true
        }
      }
    } catch (e) {
      console.warn('Native track switching failed', e)
    }

    const success = await setStreamSelection(serverInfo.uri, serverInfo.token, partId, audioId, subtitleId)
    if (success) {
      if (switchedNatively) {
        useNotificationStore.getState().addNotification('Track switched natively', { level: 'info' })
        return
      }

      // Use global time which correctly accounts for pending wheel seeks and drag states
      const offsetMs = globalTime * 1000
      let newUrl = await plexStreamBuilder.getOptimalStreamUrl(
        serverInfo,
        { id: partId, key: partKey },
        ratingKey,
        capabilities,
        playbackSessionId,
        clientSessionId,
        offsetMs,
        forceSubtitleBurnIn
      )

      // Strip offset and hash to compare if the underlying stream is actually identical
      const removeOffset = (url) => {
        if (!url) return '';
        try {
          const u = new URL(url.split('#')[0], 'http://dummy.com');
          u.searchParams.delete('offset');
          return u.pathname + u.search;
        } catch {
          return url.split('#')[0];
        }
      }

      const coreNewUrl = removeOffset(newUrl);
      const coreOldUrl = removeOffset(streamUrl);

      // If we are ONLY switching a subtitle, and the new URL (minus offset) is the same,
      // we can skip the hard restart and let the Sidecar engine handle it seamlessly.
      // But if we switched AUDIO (streamType === 2), we MUST restart the transcoder to get the new audio track!
      if (coreNewUrl === coreOldUrl && streamType === 3) {
        console.log('[PlayerPage] Video stream URL unchanged. Skipping hard restart for seamless Sidecar subtitle toggle.');
        // Don't even pause the video. Just return.
        return;
      }

      // If converting from Direct Play -> Transcode, or switching Transcoded streams, we MUST do a hard restart
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
        seekTimeoutRef.current = null
        setIsScrolling(false)
      }

      if (videoEl && !videoEl.paused) videoEl.pause()
      setIsSwitchingStream(true)

      setTimeout(() => {
        // Append cache buster to force hard reload of the stream
        newUrl += `#t=${Date.now()}`
        setStreamUrl(newUrl)
        useNotificationStore.getState().addNotification('Reloading stream...', { level: 'info', duration: 1500 })
      }, 300)
    } else {
      useNotificationStore.getState().addNotification('Failed to change stream', { level: 'error' })
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="apple-spinner large">
          <div className="bar1"></div>
          <div className="bar2"></div>
          <div className="bar3"></div>
          <div className="bar4"></div>
          <div className="bar5"></div>
          <div className="bar6"></div>
          <div className="bar7"></div>
          <div className="bar8"></div>
          <div className="bar9"></div>
          <div className="bar10"></div>
          <div className="bar11"></div>
          <div className="bar12"></div>
        </div>
        <div style={styles.loadingText}>Loading Stream...</div>
      </div>
    )
  }

  const isDash = streamUrl && streamUrl.includes('protocol=dash')
  const startSeconds = (!location.state?.startOver && metaDetails?.viewOffset > 0) ? (metaDetails.viewOffset / 1000) : 0
  const displayTime = isDragging ? dragTime : (isDash ? currentTime + startSeconds : currentTime)
  const progressPercent = duration ? (displayTime / duration) * 100 : 0

  const handleContainerClick = (e) => {
    // Prevent rogue click events from firing immediately after a scrubber drag release
    if (Date.now() - lastDragEndTimeRef.current < 500) return

    // Only toggle playback if the user clicked exactly on the background container, the video, or the bottom gradient mask.
    // If they clicked on buttons, timeline, menus, or text, do not toggle playback.
    const isBackgroundClick = 
      e.target === e.currentTarget || 
      e.target.tagName === 'VIDEO' ||
      e.target.id === 'bottom-gradient-mask'

    if (isBackgroundClick && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(err => console.error(err))
        useNotificationStore.getState().addNotification('Play', { level: 'success' })
      } else {
        videoRef.current.pause()
        useNotificationStore.getState().addNotification('Pause', { level: 'success' })
      }
    }
  }

  return (
    <div style={styles.container} onMouseMove={() => triggerHUD(true)} onClick={handleContainerClick}>
      {isSwitchingStream && (
        <div style={styles.inlineLoadingOverlay}>
          <div style={styles.inlineSpinner} />
          <div style={styles.inlineLoadingText}>Switching tracks...</div>
        </div>
      )}

      {/* Raw HTML5 Video Element for maximum Smart TV compatibility */}
      <div className="video-wrapper">
        <video
          ref={videoRef}
          className="video-element"
          autoPlay
          crossOrigin="anonymous"
          style={styles.video}
        />
      </div>

      {/* Cinematic Dark Bottom-to-Top Linear Gradient mask */}
      <div
        id="bottom-gradient-mask"
        style={{
          ...styles.bottomGradient,
          opacity: showHUD ? 1 : 0,
          pointerEvents: showHUD ? 'auto' : 'none'
        }}
      />

      {/* Custom Frameless smart-TV HUD Overlay */}
      <div
        style={{
          ...styles.hudCard,
          opacity: showHUD ? 1 : 0,
          transform: showHUD ? 'translateY(0)' : 'translateY(25px)',
          pointerEvents: showHUD ? 'auto' : 'none'
        }}
        className="player-hud-card"
      >
        {/* Metadata Details */}
        <div style={styles.hudMeta}>
          <h1 style={styles.hudTitle}>{metaDetails.title}</h1>
          {metaDetails.subtitle && <p style={styles.hudSubtitle}>{metaDetails.subtitle}</p>}
        </div>

        {/* Stream Selection Controls */}
        <div style={styles.streamControlsRow}>
          { numberOfStreams?.video?.length > 1 && <FocusableItem
            id="player-stream-video"
            rowIndex={0} colIndex={0}
            style={styles.streamBtn}
            className="hud-stream-btn"
            onClick={() => setActiveMenu(activeMenu === 'video' ? 'none' : 'video')}
          >
            {/* Video TV icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
              <polyline points="17 2 12 7 7 2"></polyline>
            </svg>
          </FocusableItem>}

          { numberOfStreams?.audio?.length > 1 && <FocusableItem
            id="player-stream-audio"
            rowIndex={0} colIndex={1}
            style={styles.streamBtn}
            className="hud-stream-btn"
            onClick={() => setActiveMenu(activeMenu === 'audio' ? 'none' : 'audio')}
          >
            {/* Minimal equalizer icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="9" x2="6" y2="15"></line>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="18" y1="11" x2="18" y2="13"></line>
            </svg>
          </FocusableItem>}

          { numberOfStreams?.subtitles?.length > 0 && <FocusableItem
            id="player-stream-subtitle"
            rowIndex={0} colIndex={2}
            style={styles.streamBtn}
            className="hud-stream-btn"
            onClick={() => setActiveMenu(activeMenu === 'subtitle' ? 'none' : 'subtitle')}
          >
            {/* Classic Subtitle Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" ry="2"></rect>
                <line x1="7" y1="10" x2="11" y2="10"></line>
                <line x1="13" y1="10" x2="17" y2="10"></line>
                <line x1="7" y1="14" x2="17" y2="14"></line>
              </svg>
              {isSubtitleCaching && (
                <div className="subtitle-caching-spinner"></div>
              )}
            </div>
          </FocusableItem>}

          {/* Active Menu Popover */}
          {activeMenu !== 'none' && (
            <div style={styles.streamMenuPopover} className="stream-menu-popover">
              {activeMenu === 'subtitle' && (
                <>
                  <FocusableItem
                    id={`stream-sub-force-burn`}
                    rowIndex={-1} colIndex={0}
                    style={{...styles.streamMenuItem, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', paddingBottom: '12px'}}
                    className="hud-stream-menu-item"
                    onClick={() => {
                      const newValue = !forceSubtitleBurnIn
                      setForceSubtitleBurnIn(newValue)
                      useNotificationStore.getState().addNotification(newValue ? 'Burn-In Forced (Requires Transcode)' : 'Burn-In Disabled (Sidecar Allowed)', { level: 'info', duration: 2000 })

                      // Trigger a stream reload with the active streams, but now using the new forceSubtitleBurnIn value
                      const activeVideo = availableStreams.find(s => s.streamType === 1 && s.selected)
                      const activeAudio = availableStreams.find(s => s.streamType === 2 && s.selected)
                      const activeSub = availableStreams.find(s => s.streamType === 3 && s.selected)

                      setTimeout(() => {
                        handleStreamSelect(3, activeSub ? activeSub.id : 0)
                      }, 100)
                    }}
                  >
                    <div style={{...styles.streamMenuRadio, borderRadius: '4px', backgroundColor: forceSubtitleBurnIn ? '#e50914' : 'transparent'}} />
                    <span style={{color: forceSubtitleBurnIn ? '#fff' : '#a8a8af', fontWeight: forceSubtitleBurnIn ? '600' : '500'}}>Force Burn-in (Transcode)</span>
                  </FocusableItem>
                  <FocusableItem
                    id={`stream-sub-visibility`}
                    rowIndex={-1} colIndex={1}
                    style={{...styles.streamMenuItem, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', paddingBottom: '12px'}}
                    className="hud-stream-menu-item"
                    onClick={() => {
                      setIsSubtitleVisible(!isSubtitleVisible)
                      useNotificationStore.getState().addNotification(isSubtitleVisible ? 'Subtitles Disabled' : 'Subtitles Enabled', { level: 'info' })
                    }}
                  >
                    <div style={{...styles.streamMenuRadio, borderRadius: '2px', backgroundColor: isSubtitleVisible ? '#fff' : 'transparent'}} />
                    <span style={{ fontWeight: 600 }}>{isSubtitleVisible ? 'Disable Subtitles' : 'Enable Subtitles'}</span>
                  </FocusableItem>
                </>
              )}
              {availableStreams.filter(s => {
                if (activeMenu === 'video') return s.streamType === 1
                if (activeMenu === 'audio') return s.streamType === 2
                if (activeMenu === 'subtitle') return s.streamType === 3
                return false
              }).map((stream, idx) => (
                <FocusableItem
                  key={stream.id}
                  id={`stream-${activeMenu}-${stream.id}`}
                  rowIndex={-1} colIndex={activeMenu === 'subtitle' ? idx + 2 : idx}
                  style={styles.streamMenuItem}
                  className="hud-stream-menu-item"
                  onClick={() => {
                    handleStreamSelect(stream.streamType, stream.id)
                    if (stream.streamType === 3) setIsSubtitleVisible(true)
                  }}
                >
                  <div style={{...styles.streamMenuRadio, backgroundColor: stream.selected ? '#fff' : 'transparent'}} />
                  <span>{stream.extendedDisplayTitle || stream.displayTitle || stream.language || stream.codec || `Stream ${stream.id}`}</span>
                </FocusableItem>
              ))}
            </div>
          )}
        </div>

        {/* Timeline Slider Track */}
        <div style={styles.timelineRow}>
          {/* Timeline starts flush from the left edge */}
          <FocusableItem
            id="player-timeline"
            rowIndex={1}
            colIndex={0}
            style={{
              ...styles.timelineTrack,
              transform: 'none', // Prevent default FocusableItem container scaling
            }}
            onPointerDown={handleTimelinePointerDown}
            className="timeline-track"
          >
            <div style={styles.timelineVisualTrack} className="timeline-visual-track">
              <div
                style={{
                  ...styles.timelineFill,
                  width: `${progressPercent}%`
                }}
              />
            </div>
            <div
              style={{
                ...styles.timelineKnob,
                left: `${progressPercent}%`
              }}
              className="timeline-knob"
            />

            {/* Floating seek target tooltip bubble directly below knob - only visible during scroll wheel seek */}
            {isScrolling && (
              <div
                style={{
                  ...styles.knobTooltip,
                  left: `${progressPercent}%`
                }}
              >
                {formatTime(displayTime)}
              </div>
            )}
          </FocusableItem>
          {/* Time Remaining exclusively on the right */}
          <span style={styles.timeText}>{formatRemainingTime(displayTime, duration)}</span>
        </div>

        {/* Playback Buttons Row */}
        <div style={styles.hudControls}>
          {/* Capsule-style Restart Button */}
          <FocusableItem
            id="player-restart"
            rowIndex={2}
            colIndex={0}
            style={styles.restartBtn}
            onClick={handleRestartClick}
            className="hud-restart-btn"
          >
            {/* Double rewind arrow SVG */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 19 2 12 11 5 11 19"></polygon>
              <polygon points="22 19 13 12 22 5 22 19"></polygon>
            </svg>
            <span style={styles.capsuleLabel}>Restart</span>
          </FocusableItem>

          {/* Capsule-style Continue/Pause Button */}
          <FocusableItem
            id="player-play"
            rowIndex={2}
            colIndex={1}
            style={styles.playPauseBtn}
            onClick={handlePlayPauseClick}
            className="hud-play-btn"
          >
            {isBuffering ? (
              <div className="apple-spinner">
                <div className="bar1"></div>
                <div className="bar2"></div>
                <div className="bar3"></div>
                <div className="bar4"></div>
                <div className="bar5"></div>
                <div className="bar6"></div>
                <div className="bar7"></div>
                <div className="bar8"></div>
                <div className="bar9"></div>
                <div className="bar10"></div>
                <div className="bar11"></div>
                <div className="bar12"></div>
              </div>
            ) : isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(2px)' }}>
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
            <span style={styles.capsuleLabel}>
              {isBuffering ? 'Buffering...' : isPlaying ? 'Pause' : 'Continue'}
            </span>
          </FocusableItem>
        </div>
      </div>

      {/* Global CSS Inject */}
      <style>{`
        @keyframes fade {
          from { opacity: 1; }
          to { opacity: 0.15; }
        }
        .apple-spinner {
          position: relative;
          width: 28px;
          height: 28px;
          display: inline-block;
        }
        .apple-spinner.large {
          width: 60px;
          height: 60px;
        }
        .apple-spinner div {
          position: absolute;
          width: 8%;
          height: 24%;
          background: #ffffff;
          left: 46%;
          top: 38%;
          border-radius: 50px;
          opacity: 0.15;
          animation: fade 1.2s linear infinite;
        }
        .apple-spinner .bar1 { transform: rotate(0deg) translate(0, -130%); animation-delay: 0s; }
        .apple-spinner .bar2 { transform: rotate(30deg) translate(0, -130%); animation-delay: -1.1s; }
        .apple-spinner .bar3 { transform: rotate(60deg) translate(0, -130%); animation-delay: -1.0s; }
        .apple-spinner .bar4 { transform: rotate(90deg) translate(0, -130%); animation-delay: -0.9s; }
        .apple-spinner .bar5 { transform: rotate(120deg) translate(0, -130%); animation-delay: -0.8s; }
        .apple-spinner .bar6 { transform: rotate(150deg) translate(0, -130%); animation-delay: -0.7s; }
        .apple-spinner .bar7 { transform: rotate(180deg) translate(0, -130%); animation-delay: -0.6s; }
        .apple-spinner .bar8 { transform: rotate(210deg) translate(0, -130%); animation-delay: -0.5s; }
        .apple-spinner .bar9 { transform: rotate(240deg) translate(0, -130%); animation-delay: -0.4s; }
        .apple-spinner .bar10 { transform: rotate(270deg) translate(0, -130%); animation-delay: -0.3s; }
        .apple-spinner .bar11 { transform: rotate(300deg) translate(0, -130%); animation-delay: -0.2s; }
        .apple-spinner .bar12 { transform: rotate(330deg) translate(0, -130%); animation-delay: -0.1s; }
        .player-hud-card {
          transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .timeline-track {
          cursor: pointer;
        }
        .timeline-visual-track {
          transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .timeline-track.focused .timeline-visual-track,
        .timeline-track:hover .timeline-visual-track {
          height: 16px !important;
        }
        .timeline-track.focused .timeline-knob,
        .timeline-track:hover .timeline-knob {
          width: 30px !important;
          height: 30px !important;
          transform: translate(-50%, -50%) scale(1.15) !important;
          box-shadow: 0 0 10px #e5a00d !important;
        }
        .hud-play-btn, .hud-restart-btn {
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease !important;
        }
        .hud-play-btn.focused, .hud-play-btn:hover,
        .hud-restart-btn.focused, .hud-restart-btn:hover {
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
          transform: scale(1.08) !important;
          outline: none;
        }
        .hud-play-btn.focused svg, .hud-play-btn:hover svg,
        .hud-restart-btn.focused svg, .hud-restart-btn:hover svg {
          fill: #ffffff !important;
          stroke: #ffffff !important;
        }
        .hud-play-btn:active, .hud-restart-btn:active {
          transform: scale(0.95) !important;
        }
        .hud-stream-btn {
          transition: transform 0.15s ease, background-color 0.15s ease !important;
        }
        .hud-stream-btn.focused, .hud-stream-btn:hover {
          background: rgba(255,255,255,0.25);
          border-color: rgba(255,255,255,0.4);
        }

        .subtitle-caching-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: subtitle-spin 1s linear infinite;
        }

        @keyframes subtitle-spin {
          to { transform: rotate(360deg); }
        }

        .hud-stream-menu-item {
          transition: background-color 0.1s ease !important;
        }
        .hud-stream-menu-item.focused, .hud-stream-menu-item:hover {
          background-color: rgba(255, 255, 255, 0.15) !important;
          outline: none !important;
        }
        video {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          background: #000 !important;
        }
      `}</style>

      {/* 
        Custom Subtitle Overlay (Managed fully by React, updated imperatively by pure logic handlers)
      */}
      <SubtitleOverlay ref={subtitleOverlayRef} isVisible={isSubtitleVisible} />
    </div>
  )
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
  },
  loadingContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0c0c0e',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
  },
  spinner: {
    width: '60px',
    height: '60px',
    border: '4px solid rgba(255, 255, 255, 0.15)',
    borderTop: '4px solid #ffffff',
    borderRadius: '50%',
  },
  loadingText: {
    fontSize: '24px',
    color: '#ffffff',
    fontWeight: '500',
    fontFamily: "'Outfit', 'Inter', sans-serif",
  },
  inlineLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 99998,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  inlineSpinner: {
    width: '45px',
    height: '45px',
    border: '3px solid rgba(255, 255, 255, 0.15)',
    borderTop: '3px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  inlineLoadingText: {
    fontSize: '20px',
    color: '#ffffff',
    fontWeight: '500',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
  },

  video: {
    width: '100vw',
    height: '100vh',
    objectFit: 'contain',
    background: '#000',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '380px',
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.5) 60%, rgba(0, 0, 0, 0) 100%)',
    zIndex: 9999,
    pointerEvents: 'none',
    transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  hudCard: {
    position: 'absolute',
    bottom: '45px',
    left: '45px',
    right: '45px',
    zIndex: 10000,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: '0 45px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    boxShadow: 'none',
  },
  hudMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  hudTitle: {
    fontSize: '34px',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-0.5px',
  },
  hudSubtitle: {
    fontSize: '20px',
    fontWeight: '500',
    color: '#a8a8af',
    margin: 0,
    fontFamily: "'Outfit', 'Inter', sans-serif",
  },
  timelineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  timeText: {
    fontSize: '24px', // TV sized typography
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    minWidth: '110px',
    textAlign: 'right',
  },
  timelineTrack: {
    flex: 1,
    height: '40px', // Substantially enlarged hover zone area
    backgroundColor: 'transparent', // Transparent backing
    position: 'relative',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    touchAction: 'none',
  },
  timelineVisualTrack: {
    width: '100%',
    height: '8px', // Default sleek thickness
    backgroundColor: '#2e2e34',
    borderRadius: '4px',
    position: 'relative',
    overflow: 'hidden',
  },
  timelineFill: {
    height: '100%',
    backgroundColor: '#a8a8af', // Elegant light grey progress fill
    borderRadius: '4px',
    boxShadow: '0 0 8px rgba(255, 255, 255, 0.15)',
  },
  timelineKnob: {
    position: 'absolute',
    top: '50%',
    width: '20px',
    height: '20px',
    backgroundColor: '#ffffff', // Pure white knob
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)', // Centered vertically
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 2px 8px rgba(0,0,0,0.5)', // Strong white outer glow
    pointerEvents: 'none',
    // transition: 'width 0.15s ease, height 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
  },
  knobTooltip: {
    position: 'absolute',
    top: '38px', // Positioned lower to prevent clipping the expanded seek bar
    transform: 'translateX(-50%)',
    backgroundColor: 'transparent', // Remove background completely
    backdropFilter: 'none', // Remove backdrop blur
    border: 'none', // Remove border completely
    padding: '0', // No padding needed for raw text
    color: '#ffffff', // Pure white text
    // textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 10px rgba(0, 0, 0, 0.5)', // Strong drop shadow for high legibility
    fontSize: '22px', // TV sized typography
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: 10005,
    boxShadow: 'none', // Remove container shadow
  },
  hudControls: {
    display: 'flex',
    justifyContent: 'flex-start', // Align continue capsule button to the left corner
    alignItems: 'center',
    gap: '20px',
    marginTop: '10px',
  },
  controlBtn: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'rgb(30, 30, 30)',
    border: '1.5px solid rgb(255, 255, 255)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  playPauseBtn: {
    width: '240px',
    boxSizing: 'border-box',
    padding: '14px 28px',
    borderRadius: '9999px', // Pill capsule shape
    backgroundColor: 'rgb(20, 20, 20)',
    border: '1.5px solid rgb(255, 255, 255)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  restartBtn: {
    width: '180px',
    boxSizing: 'border-box',
    padding: '14px 28px',
    borderRadius: '9999px', // Pill capsule shape
    backgroundColor: 'rgb(20, 20, 20)',
    border: '1.5px solid rgb(255, 255, 255)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  streamControlsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px',
    position: 'relative'
  },
  streamBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: 'rgb(30, 30, 30)',
    border: '1.5px solid rgb(255, 255, 255)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  streamMenuPopover: {
    position: 'absolute',
    bottom: '60px',
    left: 0,
    backgroundColor: 'rgb(20, 20, 20)',
    borderRadius: '12px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '240px',
    maxHeight: '300px',
    overflowY: 'auto',
    boxShadow: '0 -4px 20px rgb(0,0,0s)',
    zIndex: 10002,
    scrollbarWidth: 'none',
  },
  streamMenuItem: {
    padding: '10px 16px',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '18px',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'transparent',
  },
  streamMenuRadio: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid #fff',
  },
  capsuleLabel: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-0.3px',
  }
}
