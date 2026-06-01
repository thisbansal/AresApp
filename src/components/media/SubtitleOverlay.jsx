import React, { forwardRef, useImperativeHandle, useRef } from 'react'

/**
 * SubtitleOverlay Component
 * 
 * Uses forwardRef and useImperativeHandle to expose a high-performance setText() API.
 * This ensures React owns the DOM lifecycle (preventing ghost nodes) while allowing
 * the subtitle handler to bypass the Virtual DOM for 60fps time-synced updates.
 */
const SubtitleOverlay = forwardRef(({ isVisible }, ref) => {
  const overlayRef = useRef(null)

  // Expose the setText API directly to the parent via the ref
  useImperativeHandle(ref, () => ({
    setText: (text) => {
      if (overlayRef.current) {
        // Fast, imperative DOM update bypassing React state
        overlayRef.current.innerText = text || ''
        overlayRef.current.style.opacity = (text && isVisible !== false) ? '1' : '0'
      }
    },
    clearText: () => {
      if (overlayRef.current) {
        overlayRef.current.innerText = ''
        overlayRef.current.style.opacity = '0'
      }
    }
  }))

  React.useEffect(() => {
    if (overlayRef.current) {
      const text = overlayRef.current.innerText;
      overlayRef.current.style.opacity = (text && isVisible !== false) ? '1' : '0'
    }
  }, [isVisible])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '8%',
        left: '10%',
        right: '10%',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 2147483647,
      }}
    >
      <span
        ref={overlayRef}
        className="subtitle-overlay"
        style={{
          display: 'inline-block',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#ffffff',
          fontSize: '2.5rem',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontWeight: 400,
          lineHeight: 1.4,
          padding: '4px 16px',
          borderRadius: '6px',
          textShadow: '0px 2px 4px rgba(0,0,0,0.8)',
          whiteSpace: 'pre-line',
          opacity: 0,
          transition: 'opacity 0.1s ease-in-out'
        }}
      />
    </div>
  )
})

export default SubtitleOverlay
