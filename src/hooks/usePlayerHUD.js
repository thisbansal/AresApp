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

  const triggerHUD = useCallback(() => {
    setShowHUD(true)
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)

    hudTimeoutRef.current = setTimeout(() => {
      // Never hide while actively dragging or scrolling
      if (isDraggingRef.current || isScrollingRef.current) return

      if (cursorActiveRef.current) {
        // Cursor still on screen — defer hiding until cursor goes idle
        hudExpiredRef.current = true
      } else {
        setShowHUD(false)
        setShouldPause(0)
      }
    }, 4000)
  }, []) // stable — all checks via refs

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current)
    }
  }, [])

  return { showHUD, setShowHUD, triggerHUD, hudTimeoutRef }
}
