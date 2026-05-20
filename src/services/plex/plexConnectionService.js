import { getMainToken } from '../luna/tokenStorage'
import { DB_KINDS, getData } from '../luna/lunaService'
import { KINDS } from '../../config/app'
import { useAppStore } from '../../stores/AppStore'
import { useServerStore } from '../../stores/serverStore'

/**
 * Resolves active server info (uri and token) from either local state or storage.
 * Throws an error if they are not available.
 * 
 * @param {Object} [localServerInfo] - Local server info state object
 * @returns {Promise<{uri: string, token: string}>} Resolved server connection details
 */
export const getActiveServerInfo = async (localServerInfo = null) => {
  const appState = useAppStore.getState()
  const activeServer = useServerStore.getState().activeServer
  let uri = localServerInfo?.uri || activeServer?.uri || appState.serverUri
  let token = localServerInfo?.token || activeServer?.token || appState.token

  if (!uri || !token) {
    const [mainToken, storedUri] = await Promise.all([
      token ? Promise.resolve(token) : getMainToken(),
      uri ? Promise.resolve(uri) : getData(DB_KINDS.SERVER, KINDS.server)
    ])

    token = token || mainToken
    uri = uri || storedUri
  }

  if (!token || !uri) {
    throw new Error('No active Plex server connection or authorization token found.')
  }

  return { uri, token }
}
