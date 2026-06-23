import { useEffect, useRef, useState } from 'react'
import { useSpatialNavigation } from '../contexts/SpatialNavigationContext'


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
 * @param {number} params.currentTime - Current global video time.
 * @param {Function} params.setCurrentTime - Function to instantaneously update local UI time state.
 * @param {React.MutableRefObject} params.seekTimeoutRef - Ref to debounce playback resume after wheel scroll.
 * @param {React.MutableRefObject} params.hudTimeoutRef - Ref to clear HUD timeouts if needed.
 * @param {Function} params.executeSeek - Function to correctly execute a seek (handling both Direct Play and Transcode).
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
  currentTime,
  setCurrentTime,
  seekTimeoutRef,
  hudTimeoutRef,
  hudLockoutRef,
  executeSeek,
  activeMenu,
  setActiveMenu
}) {
  const { navigate: spatialNavigate, activeLayer } = useSpatialNavigation()
  const [shouldPause, setShouldPause] = useState(1)

  // Mirror volatile state into refs so listeners stay stable and never go stale
  const showHUDRef = useRef(showHUD)
  const isScrollingRef = useRef(isScrolling)
  const durationRef = useRef(duration)
  const currentTimeRef = useRef(currentTime)
  const targetTimeRef = useRef(null)
  const shouldPauseRef = useRef(shouldPause)
  const activeMenuRef = useRef(activeMenu)
  const activeLayerRef = useRef(activeLayer)

  // Cursor presence tracking
  const cursorActiveRef = useRef(false)
  const hudExpiredRef = useRef(false)
  const cursorTimeoutRef = useRef(null)

  // Focus Memory
  const lastFocusedIdRef = useRef(null)

  // Track focus changes within the HUD
  useEffect(() => {
    const handleFocusIn = (e) => {
      if (showHUDRef.current && e.target && e.target.id && e.target.id.startsWith('player-')) {
        lastFocusedIdRef.current = e.target.id
      }
    }
    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [])

  useEffect(() => { showHUDRef.current = showHUD }, [showHUD])
  useEffect(() => { 
    isScrollingRef.current = isScrolling
    if (!isScrolling) targetTimeRef.current = null
  }, [isScrolling])
  useEffect(() => { durationRef.current = duration }, [duration])
  useEffect(() => { currentTimeRef.current = currentTime }, [currentTime])
  useEffect(() => { shouldPauseRef.current = shouldPause }, [shouldPause])
  useEffect(() => { activeMenuRef.current = activeMenu }, [activeMenu])
  useEffect(() => { activeLayerRef.current = activeLayer }, [activeLayer])

  useEffect(() => {
    const getVideoElement = () => {
      return videoRef.current || document.querySelector('video')
    }

    // Shared helper: hide HUD and reset state
    const hideHUD = () => {
      // Don't auto-hide HUD if a popover is actively open
      if (activeMenuRef.current !== 'none') return
      
      setShowHUD(false)
      setShouldPause(0)
      hudExpiredRef.current = false
    }

    const handleMouseMove = () => {
      cursorActiveRef.current = true

      // Reset cursor idle timer on every move
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current)
      cursorTimeoutRef.current = setTimeout(() => {
        cursorActiveRef.current = false
        cursorTimeoutRef.current = null

        // Cursor just went idle — if HUD timeout already expired, hide now
        if (hudExpiredRef.current) {
          hideHUD()
        }
      }, 3000)
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
          if (showHUDRef.current) {
            if (activeMenuRef.current !== 'none') {
              // Close the popover only, keep HUD visible
              setActiveMenu('none')
              triggerHUD()
              return
            }
            // Hide controls overlay if active instead of exiting the page!
            setShowHUD(false)
            if (hudLockoutRef) hudLockoutRef.current = true // Lockout wobbly cursor events from instantly waking HUD back up!
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
        if (!showHUDRef.current) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const videoEl = getVideoElement()
            if (videoEl) {
              if (videoEl.paused) {
                videoEl.play().catch(err => console.error('Play failed:', err))
              } else {
                videoEl.pause()
              }
            }
            return
          }

          // D-Pad buttons wake the HUD or blind seek
          if (
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' ||
            e.key === 'ArrowDown'
          ) {
            e.preventDefault()

            // Blind seeking when HUD is hidden
            if (e.key === 'ArrowLeft') {
              const videoEl = getVideoElement()
              if (videoEl) {
                const newTime = Math.max(0, currentTimeRef.current - 30)
                executeSeek(newTime)
                setCurrentTime(newTime)
              }
              return
            }
            if (e.key === 'ArrowRight') {
              const videoEl = getVideoElement()
              if (videoEl) {
                const newTime = Math.min(durationRef.current || 0, currentTimeRef.current + 30)
                executeSeek(newTime)
                setCurrentTime(newTime)
              }
              return
            }

            // Up/Down wake the HUD
            triggerHUD()
            
            // Restore last focused element or default to play button
            setTimeout(() => {
              let targetId = lastFocusedIdRef.current || 'player-play'
              let targetEl = document.getElementById(targetId)
              
              // If the element isn't found (e.g. menu closed), fallback to play button
              if (!targetEl) {
                targetId = 'player-play'
                targetEl = document.getElementById(targetId)
              }
              
              if (targetEl) targetEl.focus({ preventScroll: true })
            }, 50) // Small delay to allow HUD to mount/render
            
            return
          }
        }
      }

      const videoEl = getVideoElement()
      if (!videoEl) return

      if (e.type === 'keydown') {
        // If HUD is visible, let D-pad ArrowUp/ArrowDown navigate vertical buttons,
        // and let ArrowLeft/ArrowRight skip playback directly.
        if (showHUDRef.current) {
          switch (e.key) {
            case 'ArrowLeft':
              e.preventDefault()
              if (document.activeElement && document.activeElement.id === 'player-timeline') {
                if (videoEl) {
                  const newTime = Math.max(0, currentTimeRef.current - 30)
                  executeSeek(newTime)
                  setCurrentTime(newTime)
                }
              } else {
                spatialNavigate('left')
              }
              break
            case 'ArrowRight':
              e.preventDefault()
              if (document.activeElement && document.activeElement.id === 'player-timeline') {
                if (videoEl) {
                  const newTime = Math.min(durationRef.current || 0, currentTimeRef.current + 30)
                  executeSeek(newTime)
                  setCurrentTime(newTime)
                }
              } else {
                spatialNavigate('right')
              }
              break
            case 'ArrowUp':
              e.preventDefault()
              if (document.activeElement && activeLayerRef.current === 'base') {
                if (document.activeElement.closest('.player-hud-controls')) {
                  const tl = document.getElementById('player-timeline')
                  if (tl) tl.focus({ preventScroll: true })
                  break
                } else if (document.activeElement.id === 'player-timeline') {
                  const lastId = lastFocusedIdRef.current
                  let target = null
                  if (lastId) {
                    const el = document.getElementById(lastId)
                    if (el && el.closest('.player-hud-stream-row')) target = el
                  }
                  if (!target) target = document.querySelector('.player-hud-stream-row .focusable-item')
                  if (target) target.focus({ preventScroll: true })
                  break
                } else if (document.activeElement.closest('.player-hud-stream-row')) {
                  break // Top row, do nothing
                }
              }
              spatialNavigate('up')
              break
            case 'ArrowDown':
              e.preventDefault()
              if (document.activeElement && activeLayerRef.current === 'base') {
                if (document.activeElement.closest('.player-hud-stream-row')) {
                  const tl = document.getElementById('player-timeline')
                  if (tl) tl.focus({ preventScroll: true })
                  break
                } else if (document.activeElement.id === 'player-timeline') {
                  const lastId = lastFocusedIdRef.current
                  let target = null
                  if (lastId) {
                    const el = document.getElementById(lastId)
                    if (el && el.closest('.player-hud-controls')) target = el
                  }
                  if (!target) target = document.getElementById('player-play')
                  if (target) target.focus({ preventScroll: true })
                  break
                } else if (document.activeElement.closest('.player-hud-controls')) {
                  break // Bottom row, do nothing
                }
              }
              spatialNavigate('down')
              break
            case 'Enter':
            case ' ': {
              const activeEl = document.activeElement
              // Allow native/React events to handle the Enter key for focusable items.
              // Only fallback to toggling play/pause if no HUD element is actively focused.
              if (!activeEl || activeEl.tagName === 'BODY') {
                e.preventDefault()
                // Fallback direct toggle
                if (videoEl.paused) {
                  videoEl.play().catch(err => console.error('Play failed:', err))
                } else {
                  videoEl.pause()
                }
              } else {
                // We do NOT call e.preventDefault() or activeEl.click() here.
                // We let the natural event bubble up to the focused element's React onKeyDown handler
                // which is already managed by useFocusable.js (which correctly fires onClick).
              }
              break
            }
            default:
              break
          }
          triggerHUD()
          return
        }
      }
    }

    const handleWheel = (e) => {
      // Allow native scrolling for elements that need it
      const scrollContainer = e.target && e.target.closest ? e.target.closest('.stream-menu-popover, .nav-scroll-container, .settings-content-area') : null;
      if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
        return;
      }
      
      e.preventDefault()
      triggerHUD();
      if (!showHUDRef.current) return
      if (shouldPauseRef.current < 2) {
        setShouldPause(p => p + 1)
        return
      }

      const videoEl = getVideoElement()
      if (!videoEl) return

      // Reset HUD inactivity hide timer
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)

      // Calculate seek time based on wheel delta: precisely 1 second per tick!
      const seekAmount = e.deltaY < 0 ? 1 : -1

      // Pause video instantly as scrolling starts
      if (!videoEl.paused && !isScrollingRef.current) {
        videoEl.dataset.wasPlaying = 'true'
        videoEl.pause()
      }

      setIsScrolling(true)
      
      // Initialize target time if starting a new scroll sequence
      if (targetTimeRef.current === null) {
        targetTimeRef.current = currentTimeRef.current
      }

      // Update target mathematically
      targetTimeRef.current = Math.max(
        0,
        Math.min(durationRef.current || 0, targetTimeRef.current + seekAmount)
      )

      // Instantly update UI timeline visually
      setCurrentTime(targetTimeRef.current)

      // Debounce actual playback resume by 500ms of wheel stillness
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
      seekTimeoutRef.current = setTimeout(async () => {
        setIsScrolling(false)
        seekTimeoutRef.current = null

        // Fire single network request / native seek
        if (targetTimeRef.current !== null) {
          const streamChanged = await executeSeek(targetTimeRef.current)
          targetTimeRef.current = null

          // Resume playback if we paused it internally and the stream didn't change
          const videoEl = getVideoElement()
          if (videoEl && videoEl.dataset.wasPlaying === 'true') {
            videoEl.dataset.wasPlaying = 'false'
            if (!streamChanged) {
              videoEl.play().catch(e => console.error('Play after scroll failed:', e))
            }
          }
        }
        
        // Let triggerHUD manage the timeout — it will set hudTimeoutRef internally
        // and handleMouseMove will keep extending it while cursor is alive
        triggerHUD()
      }, 500)
    }

    // Register listeners on window at highest capture-phase priority
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyDown, true)
    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyDown, true)
      window.removeEventListener('wheel', handleWheel, { passive: false })
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current)
    }
  }, [navigate]) // stable — all other state accessed via refs
}