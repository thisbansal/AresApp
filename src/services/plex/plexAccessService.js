import { getServers, getBestServerConnection, testConnectionToServer } from './plexAPIServer'

const flattenServerConnections = (servers) => (
  servers.flatMap(server => server.connections.map(connection => ({
    server,
    connection
  })))
)

export const getAccessibleServers = async (token) => {
  return getServers(token)
}

export const resolveAccessibleServer = async (token, preferredUri = null) => {
  if (!token) {
    throw new Error('An auth token is required to resolve accessible Plex servers.')
  }

  const servers = await getAccessibleServers(token)
  if (servers.length === 0) {
    throw new Error('No Plex servers are accessible for this account.')
  }

  if (preferredUri) {
    const matchedConnection = flattenServerConnections(servers).find(({ connection }) => connection.uri === preferredUri)
    if (matchedConnection) {
      const isHealthy = await testConnectionToServer(preferredUri, token, 1500)
      if (isHealthy) {
        return {
          uri: preferredUri,
          token,
          server: matchedConnection.server
        }
      }
    }
  }

  for (const server of servers) {
    const bestUri = await getBestServerConnection(server, token)
    if (bestUri) {
      return {
        uri: bestUri,
        token,
        server
      }
    }
  }

  throw new Error('Unable to resolve a reachable Plex server for this account.')
}
