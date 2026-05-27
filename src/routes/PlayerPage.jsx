import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMetadata } from '../services/plex/plexContentService'
import { createPlayQueue, setStreamSelection } from '../services/plex/plexPlaybackService'
import { useActiveServer } from '../hooks/useActiveServer'
import { useNotificationStore } from '../services/notifications/notificationStore'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { usePlaybackProgress } from '../hooks/usePlaybackProgress'
import { PLEX_CONFIG } from '../config/app'
import { usePlayerHUD } from '../hooks/usePlayerHUD'
import { useVideoMediaEvents } from '../hooks/useVideoMediaEvents'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { formatTime, formatRemainingTime } from '../utils/timeUtils'
import { plexStreamBuilder } from '../services/plex/plexStreamBuilder'
import { mediaCodecService } from '../services/MediaCodecService'
import Hls from 'hls.js'

export default function PlayerPage() {
  const { ratingKey } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [metaDetails, setMetaDetails] = useState({ title: '', subtitle: '', viewOffset: 0 })
  const [loading, setLoading] = useState(true)
  const [isSwitchingStream, setIsSwitchingStream] = useState(false)
  const [streamUrl, setStreamUrl] = useState('')
  const [playQueueItemID, setPlayQueueItemID] = useState(null)
  const [serverInfo, serverLoading] = useActiveServer(location.state?.serverInfo, navigate)
  const [availableStreams, setAvailableStreams] = useState([])
  const [numberOfStreams, setNumberOfStreams] = useState({})
  const [partId, setPartId] = useState(null)
  const [partKey, setPartKey] = useState(null)
  const [activeMenu, setActiveMenu] = useState('none') // 'none', 'subtitle', 'audio', 'video'

  // HUD Visibility & Interaction State
  const [isDragging, setIsDragging] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const seekTimeoutRef = useRef(null)

  const isTranscode = streamUrl?.includes('transcode')
  const transcodeOffset = isTranscode && !location.state?.startOver && metaDetails.viewOffset ? metaDetails.viewOffset : 0

  const { showHUD, setShowHUD, triggerHUD, hudTimeoutRef } = usePlayerHUD(loading, isDragging, isScrolling)
  const { currentTime, setCurrentTime, duration, isPlaying, isBuffering } = useVideoMediaEvents(
    videoRef, loading, isDragging, isScrolling, transcodeOffset, setIsSwitchingStream
  )

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
    setCurrentTime,
    seekTimeoutRef,
    hudTimeoutRef
  })

  usePlaybackProgress({
    serverInfo,
    ratingKey,
    playQueueItemID,
    videoRef,
    viewOffset: metaDetails.viewOffset,
    startOver: location.state?.startOver,
    isBuffering,
    isPlaying,
    duration: metaDetails.duration,
    transcodeOffset
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
          metadata.viewOffset || 0
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

    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return

    // Clean up previous Hls instance if one exists
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 600
      })
      hlsRef.current = hls

      hls.loadSource(streamUrl)
      hls.attachMedia(videoEl)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(e => console.error('[PlayerPage] Autoplay blocked or failed:', e))
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error encountered, try to recover')
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error encountered, try to recover')
              hls.recoverMediaError()
              break
            default:
              console.error('Fatal error, cannot recover', data)
              hls.destroy()
              break
          }
        }
      })
    } else {
      // Direct playback or native HLS fallback
      videoEl.removeAttribute('src') // Flush HW decoder safely before swapping stream
      videoEl.src = streamUrl
      videoEl.load()
      
      const playOnCanPlay = () => {
        videoEl.play().catch(e => console.error('[PlayerPage] Autoplay blocked or failed:', e))
        videoEl.removeEventListener('canplay', playOnCanPlay)
      }
      videoEl.addEventListener('canplay', playOnCanPlay)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
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

      const videoEl = videoRef.current || document.querySelector('video')
      if (videoEl) {
        videoEl.currentTime = newTime
      }
      setCurrentTime(newTime)
    }

    const handlePointerUp = () => {
      const videoEl = videoRef.current || document.querySelector('video')
      if (videoEl) {
        // Explicitly play video once drag pointer is released
        videoEl.play().catch(err => console.error('Play after drag failed:', err))
      }
      setIsDragging(false)
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

  const handleRestartClick = () => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return
    triggerHUD()
    videoEl.currentTime = 0
    setCurrentTime(0)
    videoEl.play().catch(err => console.error('Restart play failed:', err))
    useNotificationStore.getState().addNotification('Restarted from beginning', { level: 'info' })
  }

  const handleSeek = (direction) => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return
    triggerHUD()
    if (direction === 'back') {
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 10)
    } else {
      videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10)
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
    if (videoEl) {
      videoEl.currentTime = Math.max(0, newTime - (transcodeOffset / 1000))
    }
    setCurrentTime(newTime)
  }

  const handleStreamSelect = async (streamType, streamId) => {
    if (!partId || !partKey) return
    triggerHUD()
    const videoEl = videoRef.current || document.querySelector('video')
    const globalTime = currentTime // Use global time to correctly factor in transcode offsets

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

      // Inline seamless stream replacement
      setMetaDetails(prev => ({ ...prev, viewOffset: globalTime * 1000 }))
      if (videoEl && !videoEl.paused) videoEl.pause()
      setIsSwitchingStream(true)

      setTimeout(async () => {
        let newUrl = await plexStreamBuilder.getOptimalStreamUrl(
          serverInfo,
          { key: partKey }, // Mock part object for the builder
          ratingKey,
          capabilities,
          globalTime * 1000
        )
        
        // Append cache buster to force React/Video.js to reload the stream
        newUrl += newUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`
        
        setStreamUrl(newUrl)
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

  const displayTime = currentTime
  const progressPercent = duration ? (displayTime / duration) * 100 : 0

  return (
    <div style={styles.container} onMouseMove={() => triggerHUD()}>
      {isSwitchingStream && (
        <div style={styles.inlineLoadingOverlay}>
          <div style={styles.inlineSpinner} />
          <div style={styles.inlineLoadingText}>Switching tracks...</div>
        </div>
      )}

      {/* Raw HTML5 Video Element for maximum Smart TV compatibility */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        controls={false}
        style={styles.video}
      />

      {/* Cinematic Dark Bottom-to-Top Linear Gradient mask */}
      <div
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" ry="2"></rect>
              <line x1="7" y1="10" x2="11" y2="10"></line>
              <line x1="13" y1="10" x2="17" y2="10"></line>
              <line x1="7" y1="14" x2="17" y2="14"></line>
            </svg>
          </FocusableItem>}

          {/* Active Menu Popover */}
          {activeMenu !== 'none' && (
            <div style={styles.streamMenuPopover} className="stream-menu-popover">
              {activeMenu === 'subtitle' && (
                <FocusableItem
                  id={`stream-sub-none`}
                  rowIndex={-1} colIndex={0}
                  style={styles.streamMenuItem}
                  className="hud-stream-menu-item"
                  onClick={() => handleStreamSelect(3, 0)}
                >
                  <div style={{...styles.streamMenuRadio, backgroundColor: !availableStreams.find(s => s.streamType === 3 && s.selected) ? '#fff' : 'transparent'}} />
                  <span>None</span>
                </FocusableItem>
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
                  rowIndex={-1} colIndex={activeMenu === 'subtitle' ? idx + 1 : idx}
                  style={styles.streamMenuItem}
                  className="hud-stream-menu-item"
                  onClick={() => handleStreamSelect(stream.streamType, stream.id)}
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
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
          transform: scale(1.1) !important;
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
    backdropFilter: 'blur(2px)',
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
