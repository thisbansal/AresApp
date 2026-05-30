import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook to manage the Player's HUD overlay visibility, timeouts, and system pointer integration.
 *
 * @param {boolean} isLoading - Whether the player is currently loading.
 * @param {boolean} isDragging - Whether the user is currently dragging the timeline knob.
 * @param {boolean} isScrolling - Whether the user is currently fluid-scrolling via mouse wheel.
 * @returns {Object} { showHUD, setShowHUD, triggerHUD }
 */
export function usePlayerHUD(isLoading, isDragging, isScrolling) {
  const [showHUD, setShowHUD] = useState(true)
  const hudTimeoutRef = useRef(null)
  const hudLockoutRef = useRef(false) // Tracks manual dismissal

  // Auto-clear focus when HUD hides
  useEffect(() => {
    if (!showHUD && document.activeElement) {
      document.activeElement.blur()
    }
  }, [showHUD])

  // System Magic Remote Pointer Visibility Sync
  useEffect(() => {
    if (isLoading) return

    const handleCursorStateChange = (e) => {
      const isVisible = e.detail.visibility
      if (!isVisible) {
        // Automatically hide the controls overlay when the system pointer fades out
        setShowHUD(false)
        hudLockoutRef.current = false // Unlock when system cursor sleeps
        if (document.activeElement) {
          document.activeElement.blur()
        }
      }
    }

    document.addEventListener('cursorStateChange', handleCursorStateChange)
    return () => {
      document.removeEventListener('cursorStateChange', handleCursorStateChange)
    }
  }, [isLoading])

  // Trigger HUD presentation and reset the inactivity fadeout timeout
  const triggerHUD = useCallback((fromMouseMove = false) => {
    // Ignore mouse movements if HUD was manually dismissed
    if (fromMouseMove && hudLockoutRef.current) return

    // Explicit button presses unlock the HUD
    if (!fromMouseMove) {
      hudLockoutRef.current = false
    }

    setShowHUD(true)
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)

    hudTimeoutRef.current = setTimeout(() => {
      // Avoid hiding HUD while actively dragging or scrolling
      if (!isDragging && !isScrolling) {
        setShowHUD(false)
      }
    }, 4000)
  }, [isDragging, isScrolling])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
    }
  }, [])

  return { showHUD, setShowHUD, triggerHUD, hudTimeoutRef, hudLockoutRef }
}
