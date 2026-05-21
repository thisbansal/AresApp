import { plexBridge } from './plexBridge'

/**
 * Update the playback progress (offset) on the Plex Media Server.
 * 
 * @param {string} serverUri Active server base URI.
 * @param {string} token Active Plex auth token.
 * @param {string} ratingKey The unique key of the media item.
 * @param {number} timeMs The current playback time in milliseconds.
 * @param {string} state The playback state (e.g., 'playing', 'paused', 'stopped').
 * @param {number} [durationMs] The duration of the media item in milliseconds.
 * @returns {Promise<boolean>} True if the request succeeded.
 */
export const updatePlaybackProgress = async (serverUri, token, ratingKey, timeMs, state = 'stopped', durationMs = null) => {
  try {
    if (!serverUri || !token || !ratingKey) {
      console.warn('[plexPlaybackService] Missing parameters for progress update')
      return false
    }

    let durationStr = ''
    if (durationMs !== null && durationMs !== undefined) {
      durationStr = `&duration=${Math.floor(durationMs)}`
    }

    // Call the Plex /:/timeline endpoint
    await plexBridge.request(
      `/:/timeline?ratingKey=${ratingKey}&key=%2Flibrary%2Fmetadata%2F${ratingKey}&identifier=com.plexapp.plugins.library&time=${Math.floor(timeMs)}&state=${state}${durationStr}`,
      { method: 'GET' },
      { uri: serverUri, token }
    )
    return true
  } catch (err) {
    console.error('[plexPlaybackService] Failed to update Plex playback progress:', err)
    return false
  }
}
