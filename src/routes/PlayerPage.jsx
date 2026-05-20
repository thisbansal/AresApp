import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMetadata } from '../services/plex/plexContentService'
import { useActiveServer } from '../hooks/useActiveServer'
import { useNotificationStore } from '../services/notifications/notificationStore'
import { useFocusStore } from '../stores/FocusStore'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { usePlaybackProgress } from '../hooks/usePlaybackProgress'

// Video.js React integration
import '@videojs/react/video/skin.css'
import { createPlayer, videoFeatures } from '@videojs/react'
import { Video } from '@videojs/react/video'

const Player = createPlayer({ features: videoFeatures })

export default function PlayerPage() {
  const { ratingKey } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [streamUrl, setStreamUrl] = useState('')
  const [serverInfo, serverLoading] = useActiveServer(location.state?.serverInfo, navigate)

  // Media Playback State
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [metaDetails, setMetaDetails] = useState({ title: '', subtitle: '', viewOffset: 0 })

  // HUD Visibility & Interaction State
  const [showHUD, setShowHUD] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  
  // Real-time Fluid Scrolling States
  const [isScrolling, setIsScrolling] = useState(false)

  const showHUDRef = useRef(showHUD)
  useEffect(() => {
    showHUDRef.current = showHUD
    if (!showHUD) {
      useFocusStore.setState({ focusedId: null })
    }
  }, [showHUD])

  const videoRef = useRef(null)
  const hudTimeoutRef = useRef(null)
  const seekTimeoutRef = useRef(null)

  // Listen to video buffering events
  useEffect(() => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return

    const handleWaiting = () => {
      console.log('[PlayerPage] Video waiting/buffering...')
      setIsBuffering(true)
    }

    const handlePlaying = () => {
      setIsBuffering(false)
    }

    const handleCanPlay = () => {
      setIsBuffering(false)
    }

    const handleSeeking = () => {
      setIsBuffering(true)
    }

    const handleSeeked = () => {
      setIsBuffering(false)
    }

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
  }, [videoRef, loading])

  usePlaybackProgress({
    serverInfo,
    ratingKey,
    videoRef,
    viewOffset: metaDetails.viewOffset,
    startOver: location.state?.startOver
  })

  // Trigger HUD presentation and set inactivity fadeout
  const triggerHUD = () => {
    setShowHUD(true)
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
    hudTimeoutRef.current = setTimeout(() => {
      // Avoid hiding HUD while actively dragging or scrolling
      if (!isDragging && !isScrolling) {
        setShowHUD(false)
      }
    }, 4000)
  }

  useEffect(() => {
    if (serverLoading || !serverInfo) return

    const fetchStreamDetails = async () => {
      setLoading(true)
      try {
        const metadata = await getMetadata(serverInfo.uri, serverInfo.token, ratingKey)
        const sub = metadata.grandparentTitle
          ? `${metadata.grandparentTitle} • ${metadata.parentTitle} • Episode ${metadata.index}`
          : metadata.year || ''

        setMetaDetails({
          title: metadata.title,
          subtitle: sub,
          viewOffset: metadata.viewOffset
        })

        // Find direct stream key from metadata
        const partKey = metadata.media?.[0]?.parts?.[0]?.key
        if (!partKey) {
          throw new Error('No playable stream file found for this item.')
        }

        const absoluteUrl = `${serverInfo.uri}${partKey}?X-Plex-Token=${serverInfo.token}`
        setStreamUrl(absoluteUrl)
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

  // Sync controls HUD visibility with native webOS cursorStateChange events
  useEffect(() => {
    if (loading) return

    const handleCursorStateChange = (e) => {
      const isVisible = e.detail.visibility
      if (!isVisible) {
        // Automatically hide the controls overlay when the system pointer fades out
        setShowHUD(false)
        if (document.activeElement) {
          document.activeElement.blur()
        }
      }
    }

    document.addEventListener('cursorStateChange', handleCursorStateChange)
    return () => {
      document.removeEventListener('cursorStateChange', handleCursorStateChange)
    }
  }, [loading])

  // Smart-TV Browser History popstate overlay interception
  useEffect(() => {
    if (loading) return

    // Push dummy history entry when page completes loading
    window.history.pushState(null, null, window.location.pathname)

    const handlePopState = (e) => {
      // Prevent exit if controls or overlays are currently on screen
      if (showHUDRef.current) {
        e.preventDefault()
        // Push dummy entry again to maintain stability in history length
        window.history.pushState(null, null, window.location.pathname)
        setShowHUD(false)
        if (document.activeElement) {
          document.activeElement.blur()
        }
      } else {
        // Go back inside our React router
        navigate(-1)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [loading, navigate])

  // Custom Playback D-pad, Wheel Scrolling, and Back Remote Key Binds
  useEffect(() => {
    const getVideoElement = () => {
      return videoRef.current || document.querySelector('video')
    }

    const handleKeyDown = (e) => {
      // Remote Back Key, Escape, Backspace, webOS keycode 461, Samsung keycode 10009
      if (
        e.key === 'Escape' || 
        e.key === 'Backspace' || 
        e.key === 'BrowserBack' || 
        e.keyCode === 461 ||
        e.keyCode === 10009 ||
        e.keyCode === 27 ||
        e.keyCode === 8
      ) {
        e.preventDefault()
        e.stopPropagation()
        
        // Single fire on keydown event to prevent double navigations
        if (e.type === 'keydown') {
          if (showHUD) {
            // Hide controls overlay if active instead of exiting the page!
            setShowHUD(false)
            if (document.activeElement) {
              document.activeElement.blur()
            }
            useFocusStore.setState({ focusedId: null })
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
          } else {
            // Exit page only if HUD is already hidden
            navigate(-1)
          }
        }
        return
      }

      // Display HUD on any other button click (except Enter/Space which toggles play/pause directly without waking the HUD)
      if (e.type === 'keydown') {
        if (!showHUD) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const videoEl = getVideoElement()
            if (videoEl) {
              if (videoEl.paused) {
                videoEl.play().catch(err => console.error('Play failed:', err))
                useNotificationStore.getState().addNotification('Play', { level: 'success' })
              } else {
                videoEl.pause()
                useNotificationStore.getState().addNotification('Pause', { level: 'success' })
              }
            }
            return
          }

          // D-Pad buttons wake the HUD but do not trigger any seeks or focus jumps
          if (
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' ||
            e.key === 'ArrowDown'
          ) {
            e.preventDefault()
            triggerHUD()
            useFocusStore.setState({ focusedId: 'player-play', lastRemoteAction: Date.now() })
            return
          }
        }
      }

      const videoEl = getVideoElement()
      if (!videoEl) return

      if (e.type === 'keydown') {
        // If HUD is visible, let D-pad ArrowUp/ArrowDown navigate vertical buttons,
        // and let ArrowLeft/ArrowRight skip playback directly (since there are no other buttons next to Play/Pause).
        if (showHUD) {
          switch (e.key) {
            case 'ArrowLeft':
              e.preventDefault()
              if (videoEl) {
                videoEl.currentTime = Math.max(0, videoEl.currentTime - 10)
                useNotificationStore.getState().addNotification('Seek -10s', { level: 'info' })
                useFocusStore.setState({ focusedId: 'player-timeline', lastRemoteAction: Date.now() })
              }
              break
            case 'ArrowRight':
              e.preventDefault()
              if (videoEl) {
                videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 30)
                useNotificationStore.getState().addNotification('Seek +30s', { level: 'info' })
                useFocusStore.setState({ focusedId: 'player-timeline', lastRemoteAction: Date.now() })
              }
              break
            case 'ArrowUp':
              e.preventDefault()
              useFocusStore.setState({ lastRemoteAction: Date.now() })
              useFocusStore.getState().navigate('up')
              break
            case 'ArrowDown':
              e.preventDefault()
              useFocusStore.setState({ lastRemoteAction: Date.now() })
              useFocusStore.getState().navigate('down')
              break
            case 'Enter':
            case ' ':
              e.preventDefault()
              useFocusStore.setState({ lastRemoteAction: Date.now() })
              const focusedId = useFocusStore.getState().focusedId
              const item = useFocusStore.getState().itemsRef.get(focusedId)
              if (item && item.element) {
                item.element.click()
              } else {
                // Fallback direct toggle
                if (videoEl.paused) {
                  videoEl.play().catch(err => console.error('Play failed:', err))
                  useNotificationStore.getState().addNotification('Play', { level: 'success' })
                } else {
                  videoEl.pause()
                  useNotificationStore.getState().addNotification('Pause', { level: 'success' })
                }
              }
              break
            default:
              break
          }
          triggerHUD()
          return
        }
      }
    }

    const handleWheel = (e) => {
      e.preventDefault()
      if (!showHUD) return
      
      const videoEl = getVideoElement()
      if (!videoEl) return

      // Reset HUD inactivity hide timer
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)

      // Calculate seek time based on wheel delta: precisely 1 second per tick!
      const seekAmount = e.deltaY < 0 ? 1 : -1
      
      // Pause video instantly as scrolling starts
      if (videoEl && !videoEl.paused && !isScrolling) {
        videoEl.pause()
      }

      setIsScrolling(true)

      const newTime = Math.max(0, Math.min(duration || videoEl.duration || 0, videoEl.currentTime + seekAmount))

      // Real-time scrubbing: update video frame immediately!
      videoEl.currentTime = newTime
      setCurrentTime(newTime)

      // Debounce actual playback resume by 500ms of wheel stillness
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
      seekTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
        seekTimeoutRef.current = null
        
        // Resume video playback once scroll seek completes
        videoEl.play().catch(err => console.error('Play after scroll seek failed:', err))

        // Hide HUD after 4 seconds of inactivity
        if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
        hudTimeoutRef.current = setTimeout(() => {
          setShowHUD(false)
        }, 4000)
      }, 500)
    }

    // Register Back button capture listeners on window at highest capture-phase priority
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyDown, true)
    window.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyDown, true)
      window.removeEventListener('wheel', handleWheel)
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
    }
  }, [navigate, isDragging, duration, isScrolling, showHUD])

  // HTML5 Media Event Observers
  useEffect(() => {
    const videoEl = videoRef.current || document.querySelector('video')
    if (!videoEl) return

    const handleTimeUpdate = () => {
      if (!isDragging && !isScrolling) {
        setCurrentTime(videoEl.currentTime)
      }
    }
    const handleDurationChange = () => setDuration(videoEl.duration || 0)
    const handlePlayState = () => setIsPlaying(true)
    const handlePauseState = () => setIsPlaying(false)

    videoEl.addEventListener('timeupdate', handleTimeUpdate)
    videoEl.addEventListener('durationchange', handleDurationChange)
    videoEl.addEventListener('play', handlePlayState)
    videoEl.addEventListener('pause', handlePauseState)

    // Sync initial states if video already started loading
    setCurrentTime(videoEl.currentTime)
    setDuration(videoEl.duration || 0)
    setIsPlaying(!videoEl.paused)

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate)
      videoEl.removeEventListener('durationchange', handleDurationChange)
      videoEl.removeEventListener('play', handlePlayState)
      videoEl.removeEventListener('pause', handlePauseState)
    }
  }, [loading, isDragging, isScrolling])

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
  }, [isDragging, duration])

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    const formattedS = s < 10 ? `0${s}` : s
    if (h > 0) {
      const formattedM = m < 10 ? `0${m}` : m
      return `${h}:${formattedM}:${formattedS}`
    }
    return `${m}:${formattedS}`
  }

  const formatRemainingTime = (current, total) => {
    const remaining = total - current
    if (isNaN(remaining) || remaining <= 0) return '-0:00'
    return `-${formatTime(remaining)}`
  }

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
      videoEl.currentTime = newTime
    }
    setCurrentTime(newTime)
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
    <div style={styles.container}>


      {/* Video.js Provider (Raw clean Video element completely removing default black skin overlays) */}
      <Player.Provider>
        <Video 
          ref={videoRef}
          src={streamUrl} 
          playsInline 
          autoPlay
          controls={false}
          style={styles.video}
        />
      </Player.Provider>

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

        {/* Timeline Slider Track */}
        <div style={styles.timelineRow}>
          {/* Timeline starts flush from the left edge */}
          <FocusableItem 
            id="player-timeline"
            rowIndex={0}
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
            rowIndex={1}
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
            rowIndex={1}
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
          box-shadow: 0 0 20px #e5a00d, 0 0 10px rgba(255, 255, 255, 0.8), 0 4px 12px rgba(0,0,0,0.6) !important;
        }
        .hud-play-btn, .hud-restart-btn {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
        }
        .hud-play-btn.focused, .hud-play-btn:hover,
        .hud-restart-btn.focused, .hud-restart-btn:hover {
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
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
    transition: 'width 0.15s ease, height 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
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
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 4px 10px rgba(0, 0, 0, 0.5)', // Strong drop shadow for high legibility
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1.5px solid rgba(255, 255, 255, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
  },
  playPauseBtn: {
    width: '240px',
    boxSizing: 'border-box',
    padding: '14px 28px',
    borderRadius: '9999px', // Pill capsule shape
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
    backdropFilter: 'blur(15px)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.35)',
  },
  restartBtn: {
    width: '180px',
    boxSizing: 'border-box',
    padding: '14px 28px',
    borderRadius: '9999px', // Pill capsule shape
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
    backdropFilter: 'blur(15px)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.35)',
  },
  capsuleLabel: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-0.3px',
  }
}
