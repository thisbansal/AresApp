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
  clickedItemId
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

  return (
    <FocusableItem
      key={`${prefix}-${item.id}-${colIndex}`}
      id={`poster-${prefix}-${item.id}`}
      rowIndex={rowIndex}
      colIndex={colIndex}
      onClick={() => handleItemClick(item, prefix === 'cw', uid)}
      style={{ flexShrink: 0 }}
      className="media-card-focusable"
    >
      <div 
        className="media-card"
        style={{ viewTransitionName: clickedItemId === uid ? 'active-poster' : 'none' }}
      >
        <FallbackImage
          src={thumbUrl}
          itemId={item.id}
          alt={item.grandparentTitle || item.title}
          className="media-card-poster"
          loading="lazy"
          decoding="async"
        />
        {showUnwatchedIndicator && (
          (prefix === 'cw' || isUnwatched) ? (
            <div
              className={`unwatched-episode-ribbon ${prefix === 'cw' ? 'ribbon-bottom-left' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleToggleWatched(item)
              }}
            >
              {/* Tick checkmark (Shown on hover/cursor) */}
              <FiCheck 
                size={24} 
                className="unwatched-tick" 
                color="#fff" 
                strokeWidth={4.5} 
                style={{ transform: 'rotate(-45deg)', marginBottom: prefix === 'cw' ? '0' : '6px', marginTop: prefix === 'cw' ? '14px' : '0' }} 
              />
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
