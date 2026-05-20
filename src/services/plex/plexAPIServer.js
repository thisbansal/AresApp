import { PLEX_CONFIG } from "../../config/app";

const getHeaders = (authToken) => ({
  'Accept': 'application/json',
  'X-Plex-Product': PLEX_CONFIG.product,
  'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
  'X-Plex-Token': authToken,
  'X-Plex-Version': '1.0.0'
})

// Function to convert plex.direct URIs to plain local IP addresses (vital for WebOS reliability)
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

export const getServers = async (authToken, options = {}) => {
  const { ownedOnly = false } = options
  const res = await fetch(
    'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1',
    {
      method: 'GET',
      headers: getHeaders(authToken)
    }
  )

  if (!res.ok) throw new Error(`Failed to fetch servers: ${res.status}`)

  const servers = await res.json()

  // Return PMS resources accessible to this token, including shared servers for non-owner profiles.
  return servers
    .filter(s => s.provides === 'server' && (!ownedOnly || s.owned))
    .map(server => ({
      name: server.name,
      clientIdentifier: server.clientIdentifier,
      accessToken: server.accessToken,
      owned: !!server.owned,
      connections: server.connections
        .sort((a, b) => {
          // Prioritize: local > non-relay > relay
          if (a.local && !b.local) return -1
          if (!a.local && b.local) return 1
          if (!a.relay && b.relay) return -1
          if (a.relay && !b.relay) return 1
          return 0
        })
        .map(conn => ({
          uri: normalizeConnectionUri(conn), // Use normalized IP for reliability
          local: conn.local,
          relay: conn.relay
        }))
    }))
}

export const testConnectionToServer = async (uri, authToken, timeoutMs = 5000) => {
  try {
    const fetchPromise = fetch(uri, {
      method: 'GET',
      headers: getHeaders(authToken)
    }).then(res => res.ok)
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    })

    return await Promise.race([fetchPromise, timeoutPromise])
  } catch {
    return false
  }
}

export const getBestServerConnection = async (server, authToken) => {
  if (!server || !server.connections || server.connections.length === 0) return null

  const localConns = server.connections.filter(c => c.local)
  const remoteConns = server.connections.filter(c => !c.local)

  // 1. Try local connections with a 2000ms timeout concurrently (resolves instantly on first success)
  if (localConns.length > 0) {
    const localUri = await new Promise((resolve) => {
      let failedCount = 0
      for (const conn of localConns) {
        testConnectionToServer(conn.uri, authToken, 2000).then(ok => {
          if (ok) resolve(conn.uri)
          else {
            failedCount++
            if (failedCount === localConns.length) resolve(null)
          }
        })
      }
    })
    if (localUri) return localUri
  }

  // 2. Try remote connections with 5000ms timeout concurrently
  if (remoteConns.length > 0) {
    const remoteUri = await new Promise((resolve) => {
      let failedCount = 0
      for (const conn of remoteConns) {
        testConnectionToServer(conn.uri, authToken, 5000).then(ok => {
          if (ok) resolve(conn.uri)
          else {
            failedCount++
            if (failedCount === remoteConns.length) resolve(null)
          }
        })
      }
    })
    if (remoteUri) return remoteUri
  }

  // Fallback to the first connection if none resolved in time
  return server.connections[0]?.uri
}
