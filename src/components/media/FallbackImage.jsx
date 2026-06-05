import React, { useState } from 'react'
import { SimpleCachedImage } from '../../pages/CachedImage'

export function FallbackImage({ src, itemId, alt, style, className, loading, decoding, ...props }) {
  const [error, setError] = useState(false)

  const getInitials = (name) => {
    if (!name) return '?'
    const cleanName = name.replace(/[^a-zA-Z0-9 ]/g, '')
    const parts = cleanName.split(' ').filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Determine font size based on the width or height if provided in styles
  // Default to 24px if size can't be easily determined
  let fontSize = '24px'
  if (style && (style.width || style.height)) {
    const sizeStr = style.width || style.height
    if (typeof sizeStr === 'string' && sizeStr.includes('px')) {
      const size = parseInt(sizeStr, 10)
      if (size > 200) fontSize = '64px'
      else if (size > 150) fontSize = '48px'
      else if (size < 100) fontSize = '16px'
    }
  }

  if (!src || error) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#333',
          color: '#888',
          fontSize: fontSize,
          fontWeight: '600',
          textAlign: 'center',
          border: '1px solid #444',
          boxSizing: 'border-box'
        }}
        className={className}
      >
        {getInitials(alt)}
      </div>
    )
  }

  return (
    <SimpleCachedImage
      src={src}
      itemId={itemId}
      alt={alt}
      style={style}
      className={className}
      loading={loading}
      decoding={decoding}
      onError={(e) => {
        console.error('[FallbackImage] Failed to load image:', src)
        setError(true)
      }}
      {...props}
    />
  )
}
