import { PLEX_CONFIG } from "../../config/app";

import { sortConnectionsByRank, probeLatency } from "./plexConnectionRanker";

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
  const allServers = rawResources.filter(s => s.provides && s.provides.split(',').includes('server'))

  const mappedServers = []

  for (const server of allServers) {
    const isShared = !(server.owned === true || server.owned === 'true' || server.owned === 1 || server.owned === '1')
    if (ownedOnly && isShared) continue

    const connections = (server.connections || [])
      .map(conn => ({
        uri: conn.uri,
        local: !!conn.local,
        relay: !!conn.relay,
        address: conn.address,
        port: conn.port
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

export const testConnectionToServer = async (uri, authToken, timeoutMs = 15000) => {
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

  // Sort connections based on historical speed ranking
  const sortedConns = await sortConnectionsByRank(server.connections)

  const bestUri = await new Promise((resolve) => {
    let completedProbes = 0
    let resolved = false

    const checkDone = () => {
      completedProbes++
      if (completedProbes === sortedConns.length && !resolved) {
        resolve(null)
      }
    }

    for (const conn of sortedConns) {
      probeLatency(conn.uri, authToken, 10000).then((latency) => {
        if (latency !== null && !resolved) {
          resolved = true
          resolve(conn.uri)
        } else {
          // DNS Rebinding Fallback: If .plex.direct fails locally, try the raw IP
          if (conn.local && conn.address && conn.port) {
            const rawIpUri = `http://${conn.address}:${conn.port}`
            probeLatency(rawIpUri, authToken, 10000).then((rawLatency) => {
              if (rawLatency !== null && !resolved) {
                resolved = true
                resolve(rawIpUri)
              } else {
                checkDone()
              }
            })
          } else {
            checkDone()
          }
        }
      })
    }
  })

  return bestUri || server.connections[0]?.uri
}
