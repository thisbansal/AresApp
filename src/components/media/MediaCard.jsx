import React from 'react'
import { FocusableItem } from '../navigational/FocusableItem'
import { FallbackImage } from './FallbackImage'
import { isMediaWatched } from '../../services/plex/plexWatchedService'
import { buildImageUrl } from '../../services/plex/plexContentService'
import { useServerManagerStore } from '../../stores/serverManagerStore'
import { FiCheck, FiX } from 'react-icons/fi'

export function MediaCard({
  item,
  rowIndex,
  colIndex,
  prefix,
  showUnwatchedIndicator,
  handleItemClick,
  handleToggleWatched,
  handleRemoveFromOnDeck,
  clickedItemId,
  variant = 'poster',
  onFocus
}) {
  let isUnwatched = false;

  // Never show the unwatched ribbon on items in the "Continue Watching" (cw) row,
  // or items that are partially watched (have a viewOffset).
  if (prefix !== 'cw') {
    isUnwatched = !isMediaWatched(item) && !item.viewOffset
  }

  const uid = `${prefix}-${item.id}`

  let thumbUrl = item.thumb
  if (item._serverContext?.clientId && item.rawThumb) {
    const s = useServerManagerStore.getState().servers[item._serverContext.clientId]
    if (s && s.uri && s.accessToken) {
      thumbUrl = buildImageUrl(s.uri, item.rawThumb, s.accessToken, 400, 600)
    }
  }

  // Map variant to specific CSS classes or inline styles
  let width = 240;
  let height = 360; // default poster (2:3)
  if (variant === 'landscape') {
    width = 320;
    height = 180; // 16:9
  } else if (variant === 'square') {
    width = 240;
    height = 240; // 1:1
  }

  // Update thumbUrl to use art if landscape, as thumbnails are often posters
  if (variant === 'landscape' && item.art) {
    if (item._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId];
      if (s && s.uri && s.accessToken) {
        thumbUrl = buildImageUrl(s.uri, item.art, s.accessToken, 640, 360);
      }
    } else {
      thumbUrl = item.art;
    }
  }

  return (
    <FocusableItem
      key={`${prefix}-${item.id}-${colIndex}`}
      id={`poster-${prefix}-${item.id}`}
      rowIndex={rowIndex}
      colIndex={colIndex}
      onClick={() => handleItemClick(item, prefix === 'cw', uid)}
      onFocus={() => onFocus && onFocus(item)}
      style={{ flexShrink: 0 }}
      className="media-card-focusable"
    >
      <div 
        className="media-card"
        style={{ 
          viewTransitionName: clickedItemId === uid ? 'active-poster' : 'none',
          width: `${width}px`,
          height: `${height}px`
        }}
      >
        <FallbackImage
          src={thumbUrl}
          itemId={item.id}
          alt={item.grandparentTitle || item.title}
          className="media-card-poster"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          decoding="async"
        />
        {showUnwatchedIndicator && (
          (prefix === 'cw' || isUnwatched) ? (
            <div
              className={`unwatched-episode-ribbon ${prefix === 'cw' ? 'ribbon-bottom-left' : ''}`}
              style={prefix === 'cw' ? { pointerEvents: 'none' } : {}}
              onClick={(e) => {
                if (prefix !== 'cw') {
                  e.stopPropagation()
                  handleToggleWatched(item)
                }
              }}
            >
              {prefix === 'cw' ? (
                <div 
                  style={{ pointerEvents: 'auto', padding: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-10px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (handleRemoveFromOnDeck) handleRemoveFromOnDeck(item)
                  }}
                  className="cw-remove-btn"
                >
                  <FiX 
                    size={24} 
                    className="unwatched-tick" 
                    color="#fff" 
                    strokeWidth={4.5} 
                    style={{ transform: 'rotate(-45deg)' }} 
                  />
                </div>
              ) : (
                <FiCheck 
                  size={24} 
                  className="unwatched-tick" 
                  color="#fff" 
                  strokeWidth={4.5} 
                  style={{ transform: 'rotate(-45deg)', marginBottom: '6px', marginTop: '0' }} 
                />
              )}
            </div>
          ) : (
            <div
              className="watched-ribbon"
              onClick={(e) => {
                e.stopPropagation()
                handleToggleWatched(item)
              }}
            >
              {/* Tick checkmark (Shown by default) */}
              <FiCheck size={24} className="watched-tick" color="#fff" strokeWidth={4.5} style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }} />
              {/* Cross X (Shown on hover) */}
              <FiX size={24} className="watched-cross" color="#fff" strokeWidth={4.5} style={{ display: 'none', transform: 'rotate(-45deg)', marginBottom: '6px' }} />
            </div>
          )
        )}
        {!!item.viewOffset && item.duration && (
          <div className="media-card-progress-container">
            <div
              className="media-card-progress-fill"
              style={{
                width: `${(item.viewOffset / item.duration) * 100}%`
              }}
            />
          </div>
        )}
      </div>
    </FocusableItem>
  )
}
