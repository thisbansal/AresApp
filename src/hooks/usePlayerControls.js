import { useEffect } from 'react'
import { useSpatialNavigation } from '../contexts/SpatialNavigationContext'
import { useNotificationStore } from '../services/notifications/notificationStore'

/**
 * Custom hook to abstract all player input controls (D-Pad, Magic Remote Wheel, Return keys).
 * 
 * @param {Object} params
 * @param {React.RefObject} params.videoRef - HTML5 Video reference.
 * @param {Function} params.navigate - React Router navigation function.
 * @param {number} params.duration - Current video duration.
 * @param {boolean} params.showHUD - Whether the HUD is currently visible.
 * @param {Function} params.setShowHUD - Function to strictly set HUD state.
 * @param {Function} params.triggerHUD - Function to show HUD and reset the timeout.
 * @param {boolean} params.isDragging - Whether user is actively pointer-dragging the timeline.
 * @param {boolean} params.isScrolling - Whether user is wheel-scrolling the timeline.
 * @param {Function} params.setIsScrolling - Function to toggle wheel-scroll state.
 * @param {Function} params.setCurrentTime - Function to instantaneously update local UI time state.
 * @param {React.MutableRefObject} params.seekTimeoutRef - Ref to debounce playback resume after wheel scroll.
 * @param {React.MutableRefObject} params.hudTimeoutRef - Ref to clear HUD timeouts if needed.
 */
export function usePlayerControls({
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
}) {
  const { navigate: spatialNavigate } = useSpatialNavigation()

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
            const playBtn = document.getElementById('player-play')
            if (playBtn) playBtn.focus()
            return
          }
        }
      }

      const videoEl = getVideoElement()
      if (!videoEl) return

      if (e.type === 'keydown') {
        // If HUD is visible, let D-pad ArrowUp/ArrowDown navigate vertical buttons,
        // and let ArrowLeft/ArrowRight skip playback directly.
        if (showHUD) {
          switch (e.key) {
            case 'ArrowLeft':
              e.preventDefault()
              if (videoEl) {
                videoEl.currentTime = Math.max(0, videoEl.currentTime - 10)
                useNotificationStore.getState().addNotification('Seek -10s', { level: 'info' })
                const tl = document.getElementById('player-timeline')
                if (tl) tl.focus()
              }
              break
            case 'ArrowRight':
              e.preventDefault()
              if (videoEl) {
                videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 30)
                useNotificationStore.getState().addNotification('Seek +30s', { level: 'info' })
                const tl = document.getElementById('player-timeline')
                if (tl) tl.focus()
              }
              break
            case 'ArrowUp':
              e.preventDefault()
              spatialNavigate('up')
              break
            case 'ArrowDown':
              e.preventDefault()
              spatialNavigate('down')
              break
            case 'Enter':
            case ' ':
              e.preventDefault()
              const activeEl = document.activeElement
              if (activeEl && activeEl.tagName !== 'BODY') {
                activeEl.click()
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
}
