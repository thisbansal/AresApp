import { markAsWatched, markAsUnwatched } from './plexContentService'


/**
 * Determine if a media item is considered watched.
 * 
 * @param {Object} item - Media item metadata
 * @returns {boolean} True if watched, false otherwise
 */
export const isMediaWatched = (item) => {
  if (!item) return false
  if (item.type === 'show' || item.type === 'season') {
    return item.leafCount
      ? (Number(item.viewedLeafCount || 0) === Number(item.leafCount))
      : (Number(item.viewCount || 0) > 0 || Number(item.viewedLeafCount || 0) > 0)
  }
  return Number(item.viewCount || 0) > 0
}

/**
 * Toggles the watched state of a media item on the Plex server and displays notifications.
 * Returns the new watched state (boolean).
 * 
 * @param {string} serverUri - Plex server URI
 * @param {string} token - Plex authentication token
 * @param {Object} item - Media item to toggle watched state
 * @returns {Promise<boolean>} Resolved new watched state (true if watched)
 */
export const toggleWatchedState = async (serverUri, token, item) => {
  if (!serverUri || !token || !item) {
    throw new Error('Missing required arguments for toggleWatchedState')
  }

  const currentlyWatched = isMediaWatched(item)
  const targetWatchedState = !currentlyWatched

  if (currentlyWatched) {
    await markAsUnwatched(serverUri, token, item.id)
  } else {
    await markAsWatched(serverUri, token, item.id)
  }

  return targetWatchedState
}
