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

  const rawResources = await res.json()
  const allServers = rawResources.filter(s => s.provides === 'server')

  // Find own PMS to broker shared server requests if available
  const ownedServers = allServers.filter(s => s.owned === true || s.owned === 'true' || s.owned === 1 || s.owned === '1')
  let discoveredSharedServers = []

  for (const ownedServer of ownedServers) {
    const pmsToken = ownedServer.accessToken
    // Sort original connections to preserve plex.direct URIs for security brokering
    const sortedConnections = (ownedServer.connections || [])
      .map(conn => ({ uri: conn.uri, local: !!conn.local, relay: !!conn.relay }))
      .sort((a, b) => {
        if (a.local && !b.local) return -1
        if (!a.local && b.local) return 1
        if (!a.relay && b.relay) return -1
        if (a.relay && !b.relay) return 1
        return 0
      })

    const pmsUri = await getBestServerConnection({ connections: sortedConnections }, pmsToken)
    console.log(`[getServers] Resolved owned PMS URI for brokering ("${ownedServer.name}"): ${pmsUri}`)

    if (pmsUri) {
      try {
        console.log(`[getServers] Querying owned PMS security resources for shared servers at ${pmsUri}...`)
        const securityRes = await fetch(`${pmsUri}/security/resources`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Plex-Token': pmsToken,
            'X-Plex-Client-Identifier': PLEX_CONFIG.clientId
          }
        })
        if (securityRes.ok) {
          const securityData = await securityRes.json()
          const resourcesList = Array.isArray(securityData)
            ? securityData
            : (securityData.MediaContainer?.Device || securityData.MediaContainer?.Resource || [])

          // Filter out servers that are shared (not owned by the user)
          const sharedServers = resourcesList.filter(
            r => r.provides === 'server' &&
            !(r.owned === true || r.owned === 'true' || r.owned === 1 || r.owned === '1')
          )
          console.log(`[getServers] Discovered ${sharedServers.length} shared server(s) via owned PMS security check for "${ownedServer.name}".`)
          for (const s of sharedServers) {
            if (!discoveredSharedServers.some(ds => ds.clientIdentifier === s.clientIdentifier)) {
              discoveredSharedServers.push(s)
            }
          }
        } else {
          console.warn(`[getServers] Owned PMS security resources query failed for "${ownedServer.name}": HTTP ${securityRes.status}`)
        }
      } catch (err) {
        console.warn(`[getServers] Error querying owned PMS security resources for "${ownedServer.name}":`, err.message)
      }
    }
  }

  // Combine servers from plex.tv and those discovered via owned PMS security brokering
  const combinedServers = [...allServers]
  for (const shared of discoveredSharedServers) {
    if (!combinedServers.some(s => s.clientIdentifier === shared.clientIdentifier)) {
      combinedServers.push(shared)
    }
  }

  const mappedServers = []

  for (const server of combinedServers) {
    const isShared = !(server.owned === true || server.owned === 'true' || server.owned === 1 || server.owned === '1')
    if (ownedOnly && isShared) continue

    const connections = (server.connections || [])
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

    mappedServers.push({
      name: server.name,
      clientIdentifier: server.clientIdentifier,
      accessToken: server.accessToken,
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
