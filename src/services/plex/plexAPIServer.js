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

import { useAppStore } from "../../stores/AppStore";

export const getServers = async (authToken, options = {}) => {
  const { ownedOnly = false } = options
  const url = 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1'
  const headers = getHeaders(authToken)
  
  console.group(`[PLEX API] getServers: Discovery Request`)
  console.log('[PLEX API] Target URL:', url)
  console.log('[PLEX API] Using Token:', authToken)
  console.log('[PLEX API] Headers:', JSON.stringify(headers, null, 2))
  console.groupEnd()

  const res = await fetch(url, { method: 'GET', headers })

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
    const urlObj = new URL(uri)
    urlObj.searchParams.append('X-Plex-Token', authToken)
    urlObj.searchParams.append('X-Plex-Client-Identifier', PLEX_CONFIG.clientId)
    urlObj.searchParams.append('X-Plex-Product', PLEX_CONFIG.product)
    urlObj.searchParams.append('X-Plex-Version', '1.0.0')
    const finalUri = urlObj.toString()

    console.group(`[PLEX API] testConnectionToServer: Ping Request`)
    console.log('[PLEX API] Target URL:', finalUri)
    console.log('[PLEX API] Using Token:', authToken)
    console.groupEnd()

    const fetchPromise = fetch(finalUri, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
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
