import React, { useState } from 'react'
import { SimpleCachedImage } from '../../pages/CachedImage'

export function FallbackImage({ src, itemId, alt, style, className, loading, decoding, showFacade = false, ...props }) {
  const [error, setError] = useState(false)



  // Generate a consistent, vibrant gradient based on the title
  const getGradient = (str) => {
    if (!str) return 'linear-gradient(135deg, #2c3e50, #3498db)';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 60) % 360;
    const h3 = (h1 + 120) % 360;
    return `radial-gradient(circle at 0% 0%, hsl(${h1}, 70%, 40%), transparent 70%), 
            radial-gradient(circle at 100% 100%, hsl(${h2}, 80%, 30%), transparent 70%), 
            radial-gradient(circle at 50% 50%, hsl(${h3}, 60%, 20%), #111)`;
  }

  // Adjust font size for full text
  let fontSize = '20px'
  if (style && (style.width || style.height)) {
    const sizeStr = style.width || style.height
    if (typeof sizeStr === 'string' && sizeStr.includes('px')) {
      const size = parseInt(sizeStr, 10)
      if (size > 200) fontSize = '32px'
      else if (size > 150) fontSize = '24px'
      else if (size < 100) fontSize = '14px'
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
          background: getGradient(alt),
          color: '#ffffff',
          fontSize: fontSize,
          fontWeight: 'bold',
          textAlign: 'center',
          padding: '10%',
          boxSizing: 'border-box',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)'
        }}
        className={className}
      >
        <span style={{ 
          display: '-webkit-box', 
          WebkitLineClamp: 3, 
          WebkitBoxOrient: 'vertical', 
          overflow: 'hidden' 
        }}>
          {alt || 'Unknown'}
        </span>
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
      showFacade={showFacade}
      onError={(e) => {
        console.error('[FallbackImage] Failed to load image:', src)
        setError(true)
      }}
      {...props}
    />
  )
}
