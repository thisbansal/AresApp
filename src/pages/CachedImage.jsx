import { useState, useEffect } from 'react'
import { imageCacheService } from '../services/caching/ImageCacheService'
import { useNotificationStore } from '../services/notifications/notificationStore'

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
        useNotificationStore.getState().addNotification(`Image Load Failed: ${src}`, { level: 'dev' })
        // Fallback to original URL on error
        if (imageSrc.startsWith('data:')) {
          setImageSrc(src)
        }
      }}
    />
  )
}

/**
 * Simple cached image that doesn't show loading state
 */
export function SimpleCachedImage({ src, itemId, ...props }) {
  const [imageSrc, setImageSrc] = useState(src) // Start with original URL

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

  return <img src={imageSrc} {...props} />
}