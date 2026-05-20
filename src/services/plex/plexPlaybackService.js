import { plexBridge } from './plexBridge'

/**
 * Update the playback progress (offset) on the Plex Media Server.
 * 
 * @param {string} serverUri Active server base URI.
 * @param {string} token Active Plex auth token.
 * @param {string} ratingKey The unique key of the media item.
 * @param {number} timeMs The current playback time in milliseconds.
 * @param {string} state The playback state (e.g., 'playing', 'paused', 'stopped').
 * @returns {Promise<boolean>} True if the request succeeded.
 */
export const updatePlaybackProgress = async (serverUri, token, ratingKey, timeMs, state = 'stopped') => {
  try {
    if (!serverUri || !token || !ratingKey) {
      console.warn('[plexPlaybackService] Missing parameters for progress update')
      return false
    }

    // Call the Plex /:/progress endpoint
    await plexBridge.request(
      `/:/progress?key=${ratingKey}&identifier=com.plexapp.plugins.library&time=${Math.floor(timeMs)}&state=${state}`,
      { method: 'GET' }
    )
    return true
  } catch (err) {
    console.error('[plexPlaybackService] Failed to update Plex playback progress:', err)
    return false
  }
}
