import {PLEX_CONFIG} from '../../config/app'

const getHeaders = (authToken = null) => ({
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-Plex-Product': PLEX_CONFIG.product,
  'X-Plex-Version': PLEX_CONFIG.version,
  'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
  'X-Plex-Device': PLEX_CONFIG.device,
  'X-Plex-Device-Name': 'webOS TV',
  ...(authToken && { 'X-Plex-Token': authToken })
})

export const generatePin = async () => {
  const res = await fetch(`${PLEX_CONFIG.apiUrl}/pins`, {
    method: 'POST',
    headers: getHeaders()
  })

  if (!res.ok) throw new Error(`PIN generation failed: ${res.status}`)

  const data = await res.json()
  return {
    id: data.id,
    code: data.code,
    qr: data.qr
  }
}

export const checkPinAuth = async (pinId) => {
  const res = await fetch(`${PLEX_CONFIG.apiUrl}/pins/${pinId}`, {
    method: 'GET',
    headers: getHeaders()
  })

  if (!res.ok) throw new Error(`PIN check failed: ${res.status}`)

  const data = await res.json()
  return {
    authToken: data.authToken,
    authenticated: !!data.authToken
  }
}

export const getUsers = async (authToken) => {
  const res = await fetch('https://plex.tv/api/v2/home/users', {
    method: 'GET',
    headers: getHeaders(authToken)
  })

  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`)

  const data = await res.json()
  return data.users.map(user => {
    console.log(`[PlexAuthService] Fetched profile pic for user "${user.title}": ${user.thumb}`);
    return {
      id: user.id,
      name: user.title,
      avatar: user.thumb,
      protected: user.protected,
      admin: user.admin,
      pin: user.pin
    };
  })
}

export const verifyUserPin = async (authToken, userId, pin) => {
  const res = await fetch(`https://plex.tv/api/home/users/${userId}/switch`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify({ pin: pin || "" })
  })

  if (!res.ok) {
    throw new Error('PIN verification failed')
  }

  const text = await res.text()
  
  // 1. Try parsing XML attributes first
  const xmlMatch = text.match(/authentication-token="([^"]+)"/) || 
                   text.match(/authenticationToken="([^"]+)"/) ||
                   text.match(/authToken="([^"]+)"/)
  if (xmlMatch) {
    return xmlMatch[1]
  }

  // 2. Try JSON parsing
  try {
    const data = JSON.parse(text)
    const token = data.user?.authToken || data.authToken || data.user?.authenticationToken || null
    if (token) return token
  } catch (e) {
    // Ignore JSON parse errors
  }

  // 3. Fallback: regex search for any token string in the text
  const fallbackMatch = text.match(/"authToken"\s*:\s*"([^"]+)"/) || 
                        text.match(/"authenticationToken"\s*:\s*"([^"]+)"/)
  if (fallbackMatch) {
    return fallbackMatch[1]
  }

  return null
}