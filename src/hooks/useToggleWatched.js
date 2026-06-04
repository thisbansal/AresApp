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
    async (item, customServerInfo = null) => {
      const activeServer = customServerInfo || serverInfo
      if (!activeServer?.uri || !activeServer?.token) {
        console.warn('[useToggleWatched] Cannot toggle watched state: server credentials are missing')
        return null
      }
      try {
        return await toggleWatchedState(activeServer.uri, activeServer.token, item)
      } catch (err) {
        console.error('[useToggleWatched] Failed to toggle watched state:', err)
        return null
      }
    },
    [serverInfo]
  )
}
