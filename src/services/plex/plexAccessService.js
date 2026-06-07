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

import { getSharedServersCache } from './sharedServerService'

export const resolveAccessibleServer = async (token, preferredUri = null) => {
  if (!token) {
    throw new Error('An auth token is required to resolve accessible Plex servers.')
  }

  const servers = await getAccessibleServers(token)
  if (servers.length === 0) {
    throw new Error('No Plex servers are accessible for this account.')
  }

  const sharedCache = await getSharedServersCache()
  for (const server of servers) {
    if (!server.owned && sharedCache[server.clientIdentifier]) {
      server.accessToken = sharedCache[server.clientIdentifier].token
    }
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

  // Probe all accessible servers concurrently to race them
  const resolutionPromises = servers.map(async (server) => {
    const serverToken = getServerAccessToken(server, token)
    const bestUri = await getBestServerConnection(server, serverToken)
    if (bestUri) {
      return {
        uri: bestUri,
        token: serverToken,
        server
      }
    }
    throw new Error('Server unreachable')
  })

  return new Promise((resolve, reject) => {
    let rejectedCount = 0
    let resolved = false

    for (const promise of resolutionPromises) {
      promise.then(
        (result) => {
          if (!resolved) {
            resolved = true
            resolve(result)
          }
        },
        () => {
          rejectedCount++
          if (rejectedCount === resolutionPromises.length && !resolved) {
            reject(new Error('Unable to resolve a reachable Plex server for this account.'))
          }
        }
      )
    }

    if (resolutionPromises.length === 0) {
      reject(new Error('Unable to resolve a reachable Plex server for this account.'))
    }
  })
}
