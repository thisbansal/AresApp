import React, { forwardRef, useImperativeHandle, useRef } from 'react'

/**
 * SubtitleOverlay Component
 * 
 * Uses forwardRef and useImperativeHandle to expose a high-performance setText() API.
 * This ensures React owns the DOM lifecycle (preventing ghost nodes) while allowing
 * the subtitle handler to bypass the Virtual DOM for 60fps time-synced updates.
 */
const SubtitleOverlay = forwardRef((props, ref) => {
  const overlayRef = useRef(null)

  // Expose the setText API directly to the parent via the ref
  useImperativeHandle(ref, () => ({
    setText: (text) => {
      if (overlayRef.current) {
        // Fast, imperative DOM update bypassing React state
        overlayRef.current.innerText = text || ''
      }
    },
    clearText: () => {
      if (overlayRef.current) {
        overlayRef.current.innerText = ''
      }
    }
  }))

  return (
    <div
      ref={overlayRef}
      className="subtitle-overlay"
      style={{
        position: 'absolute',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        color: 'white',
        fontSize: '42px',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        fontWeight: 500,
        textShadow: '0px 2px 8px rgba(0,0,0,0.9), 0px 4px 16px rgba(0,0,0,0.7)',
        zIndex: 2147483647,
        pointerEvents: 'none',
        width: '90%'
      }}
    />
  )
})

export default SubtitleOverlay
