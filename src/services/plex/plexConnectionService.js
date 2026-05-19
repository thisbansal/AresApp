import { getMainToken } from '../luna/tokenStorage'
import { DB_KINDS, getData } from '../luna/lunaService'
import { KINDS } from '../../config/app'

/**
 * Resolves active server info (uri and token) from either local state or storage.
 * Throws an error if they are not available.
 * 
 * @param {Object} [localServerInfo] - Local server info state object
 * @returns {Promise<{uri: string, token: string}>} Resolved server connection details
 */
export const getActiveServerInfo = async (localServerInfo = null) => {
  let uri = localServerInfo?.uri
  let token = localServerInfo?.token

  if (!uri || !token) {
    token = await getMainToken()
    uri = await getData(DB_KINDS.SERVER, KINDS.server)
  }

  if (!token || !uri) {
    throw new Error('No active Plex server connection or authorization token found.')
  }

  return { uri, token }
}
