/**
 * Resolves the destination path and navigation type for a given media item.
 * 
 * @param {Object} item The Plex media item.
 * @param {boolean} isContinueWatching Whether the item was selected from the Continue Watching context.
 * @returns {Object} An object containing the target `path` and the action `type` ('play' or 'details').
 */
export function resolveMediaNavigation(item, isContinueWatching = false) {
  if (!item) {
    return { path: '/', type: 'home' }
  }

  if (isContinueWatching) {
    return { path: `/play/${item.id}`, type: 'play' }
  }

  let targetId = item.id
  if (item.type === 'episode' && item.grandparentRatingKey) {
    targetId = item.grandparentRatingKey
  } else if (item.type === 'season' && item.parentRatingKey) {
    targetId = item.parentRatingKey
  }

  return { path: `/details/${targetId}`, type: 'details' }
}
