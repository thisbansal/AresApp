import { getServers, getBestServerConnection, testConnectionToServer } from './plexAPIServer'

const flattenServerConnections = (servers) => (
  servers.flatMap(server => server.connections.map(connection => ({
    server,
    connection
  })))
)

const getServerAccessToken = (server, fallbackToken) => server?.accessToken || fallbackToken

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
      const serverToken = getServerAccessToken(matchedConnection.server, token)
      const isHealthy = await testConnectionToServer(preferredUri, serverToken, 1500)
      if (isHealthy) {
        return {
          uri: preferredUri,
          token: serverToken,
          server: matchedConnection.server
        }
      }
    }
  }

  for (const server of servers) {
    const serverToken = getServerAccessToken(server, token)
    const bestUri = await getBestServerConnection(server, serverToken)
    if (bestUri) {
      return {
        uri: bestUri,
        token: serverToken,
        server
      }
    }
  }

  throw new Error('Unable to resolve a reachable Plex server for this account.')
}
