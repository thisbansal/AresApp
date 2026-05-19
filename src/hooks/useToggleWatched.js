import { useCallback } from 'react'
import { toggleWatchedState } from '../services/plex/plexWatchedService'

/**
 * Custom hook providing a safe, centralized callback for toggling watched/unwatched status.
 * 
 * @param {Object} serverInfo - Resolved server info containing uri and token
 * @returns {Function} Callback function (item) => Promise<boolean|null> returning the new watched status
 */
export function useToggleWatched(serverInfo) {
  return useCallback(
    async (item) => {
      if (!serverInfo?.uri || !serverInfo?.token) {
        console.warn('[useToggleWatched] Cannot toggle watched state: server credentials are missing')
        return null
      }
      try {
        return await toggleWatchedState(serverInfo.uri, serverInfo.token, item)
      } catch (err) {
        console.error('[useToggleWatched] Failed to toggle watched state:', err)
        return null
      }
    },
    [serverInfo]
  )
}
