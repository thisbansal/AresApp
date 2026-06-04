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
  const ownedServerResource = allServers.find(s => s.owned === true || s.owned === 'true' || s.owned === 1 || s.owned === '1')
  let pmsUri = null
  let pmsToken = null

  if (ownedServerResource) {
    pmsToken = ownedServerResource.accessToken
    // Normalize own connections to determine the best connection URI
    const normalizedConnections = ownedServerResource.connections
      .map(conn => ({ uri: normalizeConnectionUri(conn), local: !!conn.local, relay: !!conn.relay }))
      .sort((a, b) => {
        if (a.local && !b.local) return -1
        if (!a.local && b.local) return 1
        if (!a.relay && b.relay) return -1
        if (a.relay && !b.relay) return 1
        return 0
      })
    
    pmsUri = await getBestServerConnection({ connections: normalizedConnections }, pmsToken)
    console.log(`[getServers] Resolved owned PMS brokering URI: ${pmsUri}`)
  }

  const mappedServers = []

  for (const server of allServers) {
    if (ownedOnly && !server.owned) continue

    let transientToken = server.accessToken
    let rawConnections = server.connections || []

    const isShared = !(server.owned === true || server.owned === 'true' || server.owned === 1 || server.owned === '1')

    if (isShared && pmsUri && pmsToken) {
      try {
        console.log(`[getServers] Brokering shared server "${server.name}" connections through own PMS...`)
        const securityUrl = `${pmsUri}/security/resources?source=server://${server.clientIdentifier}`
        const securityRes = await fetch(securityUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Plex-Token': pmsToken,
            'X-Plex-Client-Identifier': PLEX_CONFIG.clientId
          }
        })
        if (securityRes.ok) {
          const securityData = await securityRes.json()
          const serverDetails = Array.isArray(securityData) 
            ? securityData.find(s => s.clientIdentifier === server.clientIdentifier) 
            : securityData?.MediaContainer?.AuthToken || securityData

          if (serverDetails) {
            transientToken = serverDetails.accessToken || serverDetails.AuthToken || securityData.MediaContainer?.AuthToken || transientToken
            rawConnections = serverDetails.connections || rawConnections
            console.log(`[getServers] Successfully brokered shared server "${server.name}"! Connections count: ${rawConnections.length}`)
          }
        } else {
          console.warn(`[getServers] Failed to broker shared server "${server.name}" (HTTP ${securityRes.status}). Falling back to resources.`)
        }
      } catch (err) {
        console.warn(`[getServers] Error brokering shared server "${server.name}":`, err.message)
      }
    }

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

    mappedServers.push({
      name: server.name,
      clientIdentifier: server.clientIdentifier,
      accessToken: transientToken,
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
