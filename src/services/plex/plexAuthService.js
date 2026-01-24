import {PLEX_CONFIG} from '../../config/app'
import {XMLParser} from 'fast-xml-parser'

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
  return data.users.map(user => ({
    id: user.id,
    name: user.title,
    avatar: user.thumb,
    protected: user.protected,
    admin: user.admin,
    pin: user.pin
  }))
}

export const verifyUserPin = async (authToken, userId, pin) => {
  const res = await fetch(`https://plex.tv/api/home/users/${userId}/switch`, {
    method: 'POST',
    headers: {
      'X-Plex-Token': authToken,
      'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
      'X-Plex-Product': PLEX_CONFIG.product,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pin })
  })

  if (!res.ok) {
    throw new Error('PIN verification failed')
  }

  return true
}