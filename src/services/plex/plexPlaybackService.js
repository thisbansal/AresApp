import { plexBridge } from './plexBridge'

/**
 * Update the playback progress (offset) on the Plex Media Server.
 * 
 * @param {string} serverUri Active server base URI.
 * Creates a new Play Queue on the Plex Server for the specified item.
 * Creating a PlayQueue is a STRICT PREREQUISITE for reliable timeline playback syncing.
 * The Plex Server requires the resulting `playQueueItemID` in subsequent timeline sync requests
 * to correctly maintain session states and avoid duplicate "Continue Watching" tracking.
 * 
 * @param {string} serverUrl - The absolute URI of the active Plex server.
 * @param {string} token - The X-Plex-Token.
 * @param {string} ratingKey - The metadata rating key of the media item.
 * @returns {Promise<Object>} The JSON response containing `playQueueID` and `playQueueSelectedItemID`.
 */
export const createPlayQueue = async (serverUrl, token, ratingKey) => {
  try {
    if (!serverUrl || !token || !ratingKey) {
      console.warn('[plexPlaybackService] Missing parameters for createPlayQueue')
      return null
    }

    const uriParams = encodeURIComponent(encodeURIComponent(`/library/metadata/${ratingKey}`))
    const response = await plexBridge.request(
      `/playQueues?type=video&uri=library%3A%2F%2F%2Fdirectory%2F${uriParams}&shuffle=0&repeat=0&includeChapters=1`,
      { method: 'POST' },
      { uri: serverUrl, token }
    )
    
    const data = await response.json()
    return {
      playQueueID: data?.MediaContainer?.playQueueID,
      playQueueSelectedItemID: data?.MediaContainer?.playQueueSelectedItemID
    }
  } catch (err) {
    console.error('[plexPlaybackService] Failed to create play queue:', err)
    return null
  }
}

/**
 * Syncs the current playback timeline progress to the Plex Server.
 * 
 * @param {string} serverUrl - The absolute URI of the active Plex server.
 * @param {string} token - The X-Plex-Token.
 * @param {string} ratingKey - The metadata rating key of the media item.
 * @param {string} playQueueItemID - The ID generated from `createPlayQueue`. Mandatory for robust sync.
 * @param {number} timeMs - Current playback offset in milliseconds.
 * @param {number} durationMs - Total duration of the media in milliseconds.
 * @param {string} state - The playback state ('playing', 'paused', 'buffering', 'stopped').
 * @returns {Promise<boolean>} True if sync succeeded, false otherwise.
 */
export const updatePlaybackProgress = async (serverUrl, token, ratingKey, playQueueItemID, timeMs, durationMs, state = 'playing') => {
  try {
    if (!serverUrl || !token || !ratingKey || !playQueueItemID) {
      console.warn('[plexPlaybackService] Missing parameters for progress update')
      return false
    }

    // Call the Plex /:/timeline endpoint
    const metadataKey = encodeURIComponent(`/library/metadata/${ratingKey}`)
    await plexBridge.request(
      `/:/timeline?ratingKey=${ratingKey}&key=${metadataKey}&identifier=com.plexapp.plugins.library&time=${Math.floor(timeMs)}&duration=${Math.floor(durationMs)}&state=${state}&playQueueItemID=${playQueueItemID}`,
      { method: 'GET' },
      { uri: serverUrl, token }
    )
    return true
  } catch (err) {
    console.error('[plexPlaybackService] Failed to update Plex playback progress:', err)
    return false
  }
}
