import { PLEX_CONFIG } from '../../config/app'
import { DB_KINDS, getData, setData } from '../luna/lunaService'
import { getServers, getBestServerConnection, testConnectionToServer } from './plexAPIServer'

const SHARED_SERVERS_KEY = 'plexSharedServersAuth'

const getHeaders = (authToken) => ({
  'Accept': 'application/json',
  'X-Plex-Product': PLEX_CONFIG.product,
  'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
  'X-Plex-Token': authToken,
  'X-Plex-Version': '1.0.0'
})

// Normalizes connection URI from plex.direct to plain local IP (same logic as plexAPIServer.js)
const normalizeConnectionUri = (conn) => {
  if (conn.local && conn.uri.includes('plex.direct')) {
    try {
      const url = new URL(conn.uri)
      const ipPart = url.hostname.split('.')[0].replace(/-/g, '.')
      return `http://${ipPart}:${url.port}`
    } catch (e) {
      return conn.uri
    }
  }
  return conn.uri
}

/**
 * Gets the transient token for a shared server.
 * Checks if a valid non-expired (48 hours) token exists in cache,
 * otherwise triggers the discovery flow.
 */
export const getSharedServerToken = async (mainToken, serverClientId, ownServerInfo = null) => {
  const cache = await getSharedServersCache()
  const serverAuth = cache[serverClientId]

  // Check if token is valid and not expired (48 hours = 172800000 ms)
  const expirationMs = 48 * 60 * 60 * 1000
  if (serverAuth && serverAuth.token && serverAuth.uri && (Date.now() - serverAuth.timestamp < expirationMs)) {
    // Quick health probe to ensure the URI is still reachable
    const healthy = await testConnectionToServer(serverAuth.uri, serverAuth.token, 1500)
    if (healthy) {
      console.log(`[SHARED SERVER] Cached token for ${serverClientId} is valid and reachable.`)
      return serverAuth
    }
    console.warn(`[SHARED SERVER] Cached connection to ${serverAuth.uri} failed health check. Re-discovering...`)
  }

  console.log(`[SHARED SERVER] Cached token for ${serverClientId} is expired or missing. Discovering...`)
  return await discoverSharedServer(mainToken, serverClientId, ownServerInfo)
}

/**
 * Executes the Authentication & Server Discovery Flow (Steps 1-6)
 */
export const discoverSharedServer = async (mainToken, serverClientId, ownServerInfo = null) => {
  console.log(`[SHARED SERVER] Initiating discovery flow for: ${serverClientId}`)

  // Step 2: Hit /api/v2/resources to discover servers
  const resourcesRes = await fetch(
    'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1',
    {
      method: 'GET',
      headers: getHeaders(mainToken)
    }
  )

  if (!resourcesRes.ok) {
    throw new Error(`Failed to fetch resources from plex.tv: ${resourcesRes.status}`)
  }

  const resources = await resourcesRes.json()
  const allServers = resources.filter(r => r.provides === 'server')

  // Find target shared server
  const sharedServerResource = allServers.find(s => s.clientIdentifier === serverClientId)
  if (!sharedServerResource) {
    throw new Error(`Shared server ${serverClientId} not found in plex.tv resources.`)
  }

  let transientToken = null
  let rawConnections = []

  // Use the access token and connections directly from the resources response
  transientToken = sharedServerResource.accessToken
  rawConnections = sharedServerResource.connections || []

  if (!transientToken) {
    throw new Error(`Failed to resolve transient accessToken for shared server: ${serverClientId}`)
  }

  // Format and sort connections based on priority (Local -> Remote -> Relay)
  const connections = rawConnections
    .map(conn => ({
      uri: normalizeConnectionUri(conn),
      local: !!conn.local,
      relay: !!conn.relay
    }))
    .sort((a, b) => {
      if (a.local && !b.local) return -1
      if (!a.local && b.local) return 1
      if (!a.relay && b.relay) return -1
      if (a.relay && !b.relay) return 1
      return 0
    })

  if (connections.length === 0) {
    throw new Error(`No connections available for shared server: ${serverClientId}`)
  }

  // Step 5: Pick best connection to shared PMS
  console.log(`[SHARED SERVER] Probing connections to shared server in strict priority order...`)
  let bestUri = null

  // 1. Try local connections
  const localConns = connections.filter(c => c.local)
  if (localConns.length > 0) {
    for (const conn of localConns) {
      const ok = await testConnectionToServer(conn.uri, transientToken, 2000)
      if (ok) {
        bestUri = conn.uri
        break
      }
    }
  }

  // 2. Try remote connections (non-relay)
  if (!bestUri) {
    const remoteConns = connections.filter(c => !c.local && !c.relay)
    for (const conn of remoteConns) {
      const ok = await testConnectionToServer(conn.uri, transientToken, 3000)
      if (ok) {
        bestUri = conn.uri
        break
      }
    }
  }

  // 3. Try relay connections
  if (!bestUri) {
    const relayConns = connections.filter(c => c.relay)
    for (const conn of relayConns) {
      const ok = await testConnectionToServer(conn.uri, transientToken, 3000)
      if (ok) {
        bestUri = conn.uri
        break
      }
    }
  }

  // Fallback to first connection if none responded
  if (!bestUri) {
    bestUri = connections[0].uri
    console.warn(`[SHARED SERVER] No connection responded. Falling back to: ${bestUri}`)
  }

  const authData = {
    token: transientToken,
    uri: bestUri,
    connections,
    timestamp: Date.now()
  }

  // Save to persistent storage
  const cache = await getSharedServersCache()
  cache[serverClientId] = authData
  await saveSharedServersCache(cache)

  return authData
}

export const getSharedServersCache = async () => {
  const data = await getData(DB_KINDS.SERVER, SHARED_SERVERS_KEY)
  return data || {}
}

export const saveSharedServersCache = async (cache) => {
  return await setData(DB_KINDS.SERVER, SHARED_SERVERS_KEY, cache)
}
