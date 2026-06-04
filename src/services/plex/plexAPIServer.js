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
  console.log(`[getServers] Raw resources from plex.tv/api/v2/resources:`, JSON.stringify(rawResources, null, 2))
  console.log(`[getServers] Raw resources type: ${typeof rawResources}, isArray: ${Array.isArray(rawResources)}`)
  if (Array.isArray(rawResources) && rawResources.length > 0) {
    console.log(`[getServers] First resource keys:`, Object.keys(rawResources[0]))
    console.log(`[getServers] First resource provides: "${rawResources[0].provides}", clientIdentifier: "${rawResources[0].clientIdentifier}", name: "${rawResources[0].name}"`)
  }

  const allServers = rawResources.filter(s => s.provides === 'server')
  console.log(`[getServers] Filtered servers:`, allServers.map(s => ({ name: s.name, clientIdentifier: s.clientIdentifier, owned: s.owned })))

  // Find own PMS to broker shared server requests if available
  const ownedServers = allServers.filter(s => s.owned === true || s.owned === 'true' || s.owned === 1 || s.owned === '1')
  let discoveredSharedServers = []

  for (const ownedServer of ownedServers) {
    const pmsToken = ownedServer.accessToken
    if (!pmsToken) {
      console.log(`[getServers] Skipping owned server "${ownedServer.name}" due to missing accessToken.`)
      continue
    }
    // Normalize and sort connections to use standard 192.x.x.x:port addresses for local calls
    const sortedConnections = (ownedServer.connections || [])
      .map(conn => ({ uri: normalizeConnectionUri(conn), local: !!conn.local, relay: !!conn.relay }))
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
      const otherServers = allServers.filter(s => s.clientIdentifier !== ownedServer.clientIdentifier)
      for (const otherServer of otherServers) {
        try {
          const targetId = '57297bb0dd5fd3d97e5420502c63791a95414d33'
          const securityUrl = `${pmsUri}/security/resources?source=${targetId}&refresh=1`
          console.log(`[getServers] Querying security resources for "${otherServer.name}" (ID: ${targetId}) via "${ownedServer.name}" at: ${securityUrl}`)
          const securityRes = await fetch(securityUrl, {
            method: 'GET',
            headers: getHeaders(pmsToken)
          })
          if (securityRes.ok) {
            const securityData = await securityRes.json()
            const serverDetails = Array.isArray(securityData)
              ? securityData.find(s => s.clientIdentifier === targetId)
              : (securityData.MediaContainer?.Device || securityData.MediaContainer?.Resource || []).find(s => s.clientIdentifier === targetId) || securityData?.MediaContainer || securityData

            if (serverDetails) {
              const token = serverDetails.accessToken || serverDetails.AuthToken || securityData.MediaContainer?.AuthToken || otherServer.accessToken
              const conns = serverDetails.connections || otherServer.connections || []

              const updatedServer = {
                ...otherServer,
                accessToken: token,
                connections: conns
              }
              if (!discoveredSharedServers.some(ds => ds.clientIdentifier === updatedServer.clientIdentifier)) {
                discoveredSharedServers.push(updatedServer)
              }
            }
          } else {
            console.warn(`[getServers] Security resources query failed for "${otherServer.name}" on "${ownedServer.name}": HTTP ${securityRes.status}`)
          }
        } catch (err) {
          console.warn(`[getServers] Error querying security resources for "${otherServer.name}" on "${ownedServer.name}":`, err.message)
        }
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
