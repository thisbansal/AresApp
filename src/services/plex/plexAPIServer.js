import { PLEX_CONFIG } from "../../config/app";

const getHeaders = (authToken) => ({
  'Accept': 'application/json',
  'X-Plex-Product': PLEX_CONFIG.product,
  'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
  'X-Plex-Token': authToken,
  'X-Plex-Version': '1.0.0'
})

// Removed normalizeConnectionUri to preserve native .plex.direct URIs

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

  const rawResources = await res.json()
  const allServers = rawResources.filter(s => s.provides === 'server')

  const mappedServers = []

  for (const server of allServers) {
    const isShared = !(server.owned === true || server.owned === 'true' || server.owned === 1 || server.owned === '1')
    if (ownedOnly && isShared) continue

    const connections = (server.connections || [])
      .map(conn => ({
        uri: conn.uri,
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

    mappedServers.push({
      name: server.name,
      clientIdentifier: server.clientIdentifier,
      accessToken: server.accessToken || authToken,
      owned: !isShared,
      connections
    })
  }

  return mappedServers
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

  // 1. Try local connections with a 5000ms timeout concurrently (resolves instantly on first success)
  if (localConns.length > 0) {
    const localUri = await new Promise((resolve) => {
      let failedCount = 0
      
      const checkDone = () => {
        failedCount++
        if (failedCount === localConns.length) resolve(null)
      }

      for (const conn of localConns) {
        // Try the secure .plex.direct URI first
        testConnectionToServer(conn.uri, authToken, 5000).then(ok => {
          if (ok) {
            resolve(conn.uri)
          } else {
            // DNS Rebinding Fallback: If .plex.direct fails on the local network, 
            // the router is likely blocking it. Fallback to raw HTTP IP.
            if (conn.address && conn.port) {
              const rawIpUri = `http://${conn.address}:${conn.port}`
              testConnectionToServer(rawIpUri, authToken, 5000).then(rawOk => {
                if (rawOk) resolve(rawIpUri)
                else checkDone()
              })
            } else {
              checkDone()
            }
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
