import { PLEX_CONFIG } from "../../config/app";

const getHeaders = (authToken) => ({
  'Accept': 'application/json',
  'X-Plex-Product': PLEX_CONFIG.product,
  'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
  'X-Plex-Token': authToken,
  'X-Plex-Version': '1.0.0'
})

export const getServers = async (authToken) => {
  const res = await fetch(
    'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1',
    {
      method: 'GET',
      headers: getHeaders(authToken)
    }
  )

  if (!res.ok) throw new Error(`Failed to fetch servers: ${res.status}`)

  const servers = await res.json()

  // Filter for owned PMS instances (not clients)
  return servers
    .filter(s => s.provides === 'server' && s.owned)
    .map(server => ({
      name: server.name,
      clientIdentifier: server.clientIdentifier,
      accessToken: server.accessToken,
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
          uri: conn.uri,
          local: conn.local,
          relay: conn.relay
        }))
    }))
}

export const testConnectionToServer = async (uri, authToken) => {
  try {
    const res = await fetch(uri, {
      method: 'GET',
      headers: getHeaders(authToken)
    })
    return res.ok
  } catch {
    return false
  }
}