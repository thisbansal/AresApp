import { PLEX_CONFIG } from '../../config/app'

const getHeaders = (authToken) => ({
  'Accept': 'application/json',
  'X-Plex-Product': PLEX_CONFIG.product,
  'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
  'X-Plex-Token': authToken,
  'X-Plex-Version': '1.0.0'
})

/**
 * Verifies if the global Plex.tv authentication token is still valid.
 * 
 * @param {string} token - The user's main auth token
 * @returns {Promise<boolean>} True if valid, false if 401 Unauthorized
 */
export const verifyGlobalToken = async (token) => {
  if (!token) return false

  try {
    const res = await fetch('https://plex.tv/api/v2/user', {
      method: 'GET',
      headers: getHeaders(token)
    })
    
    if (res.status === 401) {
      return false
    }

    return res.ok
  } catch (error) {
    // If it's a network error (like offline), we assume the token is still valid
    // to avoid logging the user out just because they lost internet connection.
    console.warn('[Token Verification] Network error during token verification:', error)
    return true 
  }
}
