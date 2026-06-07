import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { useBrowserStore } from '../../stores/browserStore'

/**
 * SubtitleOverlay Component
 * 
 * Uses forwardRef and useImperativeHandle to expose a high-performance setText() API.
 * This ensures React owns the DOM lifecycle (preventing ghost nodes) while allowing
 * the subtitle handler to bypass the Virtual DOM for 60fps time-synced updates.
 */
const SubtitleOverlay = forwardRef(({ isVisible }, ref) => {
  const overlayRef = useRef(null)

  const subtitleColor = useBrowserStore(state => state.subtitleColor) || '#AAAAAA'
  const subtitleSize = useBrowserStore(state => state.subtitleSize) || '2.5rem'

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

  const strokeColor = 'rgba(0,0,0,1)'
  
  // Simulate a 1px stroke using 8-directional text-shadows so it sits completely behind the text
  // This eliminates the jagged overlap effect caused by WebkitTextStroke on intersecting letters
  const strokeShadow = `
    -1px -1px 0 ${strokeColor},
     1px -1px 0 ${strokeColor},
    -1px  1px 0 ${strokeColor},
     1px  1px 0 ${strokeColor},
     0px -1px 0 ${strokeColor},
     0px  1px 0 ${strokeColor},
    -1px  0px 0 ${strokeColor},
     1px  0px 0 ${strokeColor}
  `

  const baseShadow = '0px 2px 4px rgba(0,0,0,1), 0px 0px 10px rgba(0,0,0,1)'

  const combinedShadow = `${strokeShadow}, ${baseShadow}`

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
          color: subtitleColor,
          fontSize: subtitleSize,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', Roboto, sans-serif",
          fontWeight: 600,
          letterSpacing: '0.5px',
          lineHeight: 1.4,
          padding: '4px 16px',
          borderRadius: '6px',
          textShadow: combinedShadow,
          whiteSpace: 'pre-line',
          opacity: 0,
          transition: 'opacity 0.1s ease-in-out'
        }}
      />
    </div>
  )
})

export default SubtitleOverlay
