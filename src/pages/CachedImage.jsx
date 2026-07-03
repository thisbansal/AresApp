import { useState, useEffect } from 'react'
import { imageCacheService } from '../services/caching/ImageCacheService'

/**
 * CachedImage Component
 *
 * Automatically caches images in webOS storage for instant offline access
 * First render: shows original URL while caching in background
 * Subsequent renders: shows cached base64 instantly (no network call!)
 */
export function CachedImage({ src, itemId, alt, style, className, loading = 'lazy' }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadImage = async () => {
      if (!src || !itemId) {
        setImageSrc(null)
        return
      }

      // Get cached image (returns cached base64 or downloads and caches)
      const cachedSrc = await imageCacheService.getCachedImage(src, itemId)

      if (mounted) {
        setImageSrc(cachedSrc)
      }
    }

    loadImage()

    return () => {
      mounted = false
    }
  }, [src, itemId])

  // Show placeholder while loading
  if (!imageSrc) {
    return (
      <div
        style={{
          ...style,
          background: '#222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '48px',
        }}
        className={className}
      >
        ⏳
      </div>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      style={style}
      className={className}
      loading={loading}
      decoding="async"
      onLoad={() => setIsLoaded(true)}
      onError={(e) => {
        console.error('[CachedImage] Failed to load:', itemId)
        // Fallback to original URL on error
        if (imageSrc.startsWith('data:')) {
          setImageSrc(src)
        }
      }}
    />
  )
}

export function SimpleCachedImage({ src, itemId, style, className, ...props }) {
  const [imageSrc, setImageSrc] = useState(src) // Start with original URL
  const [isLoaded, setIsLoaded] = useState(false)
  const [showShimmer, setShowShimmer] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadCached = async () => {
      if (!src || !itemId) return

      const cachedSrc = await imageCacheService.getCachedImage(src, itemId)

      if (mounted && cachedSrc) {
        setImageSrc(cachedSrc)
      }
    }

    loadCached()

    return () => {
      mounted = false
    }
  }, [src, itemId])

  // Debounce the shimmer so it doesn't flash on images that are already in browser cache
  useEffect(() => {
    let timer;
    if (!isLoaded) {
      timer = setTimeout(() => {
        setShowShimmer(true)
      }, 150)
    } else {
      setShowShimmer(false)
    }
    return () => clearTimeout(timer)
  }, [isLoaded])

  return (
    <div style={{ position: 'relative', width: style?.width || '100%', height: style?.height || '100%', display: 'inline-block' }}>
      {(!isLoaded && showShimmer) && (
        <div 
          className="skeleton-shimmer"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#2a2d31', // Base grey
            borderRadius: style?.borderRadius || (className === 'media-card-poster' ? '12px' : '0'),
            overflow: 'hidden',
            zIndex: 1
          }}
        />
      )}
      <img 
        src={imageSrc} 
        style={{ ...style, opacity: isLoaded ? 1 : 0, transition: 'opacity 0.2s ease-in', position: 'relative', zIndex: 2 }} 
        className={className}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)} // Don't show shimmer forever on error
        {...props} 
      />
    </div>
  )
}