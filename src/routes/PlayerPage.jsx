import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMetadata } from '../services/plex/plexContentService'
import { getMainToken } from '../services/luna/tokenStorage'
import { DB_KINDS, getData } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { useNotificationStore } from '../services/notifications/notificationStore'
import { useFocusStore } from '../stores/FocusStore'
import { FocusableItem } from '../components/navigational/FocusableItem'

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
  const [serverInfo, setServerInfo] = useState(location.state?.serverInfo || null)

  // Media Playback State
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [metaDetails, setMetaDetails] = useState({ title: '', subtitle: '' })

  // HUD Visibility & Interaction State
  const [showHUD, setShowHUD] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)
  
  // Real-time Fluid Scrolling States
  const [isScrolling, setIsScrolling] = useState(false)
  const [scrollTime, setScrollTime] = useState(0)

  useEffect(() => {
    if (!showHUD) {
      useFocusStore.setState({ focusedId: null })
    }
  }, [showHUD])

  const videoRef = useRef(null)
  const hudTimeoutRef = useRef(null)
  const seekTimeoutRef = useRef(null)

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
    const fetchStreamDetails = async () => {
      setLoading(true)
      try {
        let uri = serverInfo?.uri
        let token = serverInfo?.token

        if (!uri || !token) {
          token = await getMainToken()
          uri = await getData(DB_KINDS.SERVER, KINDS.server)

          if (!token || !uri) {
            navigate('/')
            return
          }
          setServerInfo({ uri, token })
        }

        const metadata = await getMetadata(uri, token, ratingKey)
        const sub = metadata.grandparentTitle
          ? `${metadata.grandparentTitle} • ${metadata.parentTitle} • Episode ${metadata.index}`
          : metadata.year || ''

        setMetaDetails({
          title: metadata.title,
          subtitle: sub
        })

        // Find direct stream key from metadata
        const partKey = metadata.media?.[0]?.parts?.[0]?.key
        if (!partKey) {
          throw new Error('No playable stream file found for this item.')
        }

        const absoluteUrl = `${uri}${partKey}?X-Plex-Token=${token}`
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
  }, [ratingKey, navigate])

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
      if (showHUD) {
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
  }, [loading, showHUD, navigate])

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

          triggerHUD()
          useFocusStore.setState({ focusedId: 'player-play', lastRemoteAction: Date.now() })
          
          // Let arrow keys skip time on their initial press even when waking up the HUD
          const videoEl = getVideoElement()
          if (videoEl) {
            if (e.key === 'ArrowLeft') {
              videoEl.currentTime = Math.max(0, videoEl.currentTime - 10)
              useNotificationStore.getState().addNotification('Seek -10s', { level: 'info' })
            } else if (e.key === 'ArrowRight') {
              videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10)
              useNotificationStore.getState().addNotification('Seek +10s', { level: 'info' })
            }
          }
          e.preventDefault()
          return
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
              }
              break
            case 'ArrowRight':
              e.preventDefault()
              if (videoEl) {
                videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10)
                useNotificationStore.getState().addNotification('Seek +10s', { level: 'info' })
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
      triggerHUD()
      const videoEl = getVideoElement()
      if (!videoEl) return

      // Scroll UP -> Seek Forward (+5s), Scroll DOWN -> Seek Backward (-5s)
      const seekAmount = e.deltaY < 0 ? 5 : -5
      setIsScrolling(true)

      setScrollTime(prev => {
        const isSequenceActive = seekTimeoutRef.current !== null
        const baseTime = isSequenceActive ? prev : videoEl.currentTime
        const newTime = Math.max(0, Math.min(duration || videoEl.duration || 0, baseTime + seekAmount))

        // Debounce actual player scrobble by exactly 450ms of wheel stillness
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
        seekTimeoutRef.current = setTimeout(() => {
          videoEl.currentTime = newTime
          // Explicitly play video once scroll seek completes
          videoEl.play().catch(err => console.error('Auto-play after scroll seek failed:', err))
          setIsScrolling(false)
          seekTimeoutRef.current = null
        }, 450)

        return newTime
      })
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
  }, [navigate, isDragging, dragTime, duration, isScrolling, scrollTime, showHUD])

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
      setDragTime(newTime)
    }

    const handlePointerUp = () => {
      const videoEl = videoRef.current || document.querySelector('video')
      if (videoEl) {
        videoEl.currentTime = dragTime
        setCurrentTime(dragTime)
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
  }, [isDragging, dragTime, duration])

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
    setDragTime(newTime)
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} className="spinner"></div>
        <div style={styles.loadingText}>Loading Stream...</div>
      </div>
    )
  }

  const displayTime = isDragging ? dragTime : (isScrolling ? scrollTime : currentTime)
  const progressPercent = duration ? (displayTime / duration) * 100 : 0

  return (
    <div style={styles.container}>
      {/* Premium Translucent Glass Back Button */}
      <FocusableItem 
        id="player-back"
        rowIndex={0}
        colIndex={1}
        style={{
          ...styles.backButton,
          opacity: showHUD ? 1 : 0,
          transform: showHUD ? 'translateY(0)' : 'translateY(-20px)',
          pointerEvents: showHUD ? 'auto' : 'none'
        }}
        onClick={() => {
          if (showHUD) {
            setShowHUD(false)
            if (document.activeElement) {
              document.activeElement.blur()
            }
            useFocusStore.setState({ focusedId: null })
          } else {
            navigate(-1)
          }
        }}
        className="player-back-btn"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </FocusableItem>

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
          <div 
            style={styles.timelineTrack} 
            onPointerDown={handleTimelinePointerDown}
            className="timeline-track"
          >
            <div 
              style={{
                ...styles.timelineFill,
                width: `${progressPercent}%`
              }} 
            />
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
          </div>
          {/* Time Remaining exclusively on the right */}
          <span style={styles.timeText}>{formatRemainingTime(displayTime, duration)}</span>
        </div>

        {/* Playback Buttons Row */}
        <div style={styles.hudControls}>
          {/* Capsule-style Continue/Pause Button */}
          <FocusableItem 
            id="player-play"
            rowIndex={1}
            colIndex={0}
            style={styles.playPauseBtn} 
            onClick={handlePlayPauseClick}
            className="hud-play-btn"
          >
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(2px)' }}>
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
            <span style={styles.capsuleLabel}>{isPlaying ? 'Pause' : 'Continue'}</span>
          </FocusableItem>
        </div>
      </div>

      {/* Global CSS Inject */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        .player-back-btn {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.25s ease, opacity 0.35s ease;
        }
        .player-back-btn.focused, .player-back-btn:hover {
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
          transform: scale(1.08) !important;
          outline: none;
        }
        .player-hud-card {
          transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .timeline-track {
          transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .timeline-track:hover {
          height: 16px !important;
        }
        .timeline-track:hover .timeline-knob {
          width: 24px !important;
          height: 24px !important;
          transform: translateX(-50%) scale(1.1) !important;
        }
        .hud-play-btn {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
        }
        .hud-play-btn.focused, .hud-play-btn:hover {
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
          transform: scale(1.08) !important;
          outline: none;
        }
        .hud-play-btn.focused svg, .hud-play-btn:hover svg {
          fill: #ffffff !important;
          stroke: #ffffff !important;
        }
        .hud-play-btn:active {
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
  backButton: {
    position: 'absolute',
    top: '45px',
    left: '45px',
    zIndex: 10002,
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    border: '1.5px solid rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(15px)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
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
    height: '12px',
    backgroundColor: '#2e2e34', // Elegant dark grey seek bar track
    borderRadius: '6px',
    position: 'relative',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    touchAction: 'none',
  },
  timelineFill: {
    height: '100%',
    backgroundColor: '#a8a8af', // Elegant light grey progress fill
    borderRadius: '6px',
    boxShadow: '0 0 8px rgba(255, 255, 255, 0.15)',
  },
  timelineKnob: {
    position: 'absolute',
    width: '20px',
    height: '20px',
    backgroundColor: '#ffffff', // Pure white knob
    borderRadius: '50%',
    transform: 'translateX(-50%)',
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 2px 8px rgba(0,0,0,0.5)', // Strong white outer glow to make it stand out beautifully!
    pointerEvents: 'none',
    transition: 'width 0.15s ease, height 0.15s ease, transform 0.15s ease',
  },
  knobTooltip: {
    position: 'absolute',
    top: '28px', // Sleek bubble directly under knob
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    padding: '6px 14px',
    borderRadius: '6px',
    color: '#000000', // high contrast dark text
    fontSize: '22px', // TV sized tooltip
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: 10005,
    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
  },
  hudControls: {
    display: 'flex',
    justifyContent: 'flex-start', // Align continue capsule button to the left corner
    alignItems: 'center',
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
