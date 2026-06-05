import { getOnDeck, getRecentlyAdded } from './plexContentService'
import { useServerManagerStore } from '../../stores/serverManagerStore'

/**
 * Fetches "On Deck" (Continue Watching) items from all available servers concurrently,
 * merges them, and explicitly tracks which server each item belongs to.
 */
export const getMultiServerOnDeck = async (limitPerServer = 20) => {
  const servers = Object.values(useServerManagerStore.getState().servers)
  if (servers.length === 0) {
    return []
  }

  const promises = servers.map(async (server) => {
    try {
      // getOnDeck returns an array of media items
      const items = await getOnDeck(server.uri, server.accessToken, limitPerServer)
      
      // Inject server context into each item so routing works easily
      return items.map(item => ({
        ...item,
        _serverContext: {
          clientId: server.clientIdentifier
        }
      }))
    } catch (err) {
      console.warn(`[MULTI-SERVER HUB] Failed to fetch onDeck for ${server.name}:`, err)
      return []
    }
  })

  const results = await Promise.allSettled(promises)
  
  // Flatten results
  const allItems = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .flat()

  // Sort combined items by lastViewedAt (most recently watched first)
  // Fallback to addedAt if lastViewedAt is missing
  allItems.sort((a, b) => {
    const timeA = a.lastViewedAt || a.addedAt || 0
    const timeB = b.lastViewedAt || b.addedAt || 0
    return timeB - timeA // Descending
  })

  // For cache sorting accuracy, fetch 50 per server and slice global top 50
  return allItems.slice(0, 50)
}

export const getMultiServerRecentlyAdded = async (limitPerServer = 40) => {
  const servers = Object.values(useServerManagerStore.getState().servers)
  if (servers.length === 0) {
    return []
  }

  const promises = servers.map(async (server) => {
    try {
      const items = await getRecentlyAdded(server.uri, server.accessToken, null, limitPerServer)
      return items.map(item => ({
        ...item,
        _serverContext: {
          clientId: server.clientIdentifier
        }
      }))
    } catch (err) {
      console.warn(`[MULTI-SERVER HUB] Failed to fetch recentlyAdded for ${server.name}:`, err)
      return []
    }
  })

  const results = await Promise.allSettled(promises)
  
  const allItems = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .flat()

  // Sort combined items by addedAt
  allItems.sort((a, b) => {
    const timeA = a.addedAt || 0
    const timeB = b.addedAt || 0
    return timeB - timeA // Descending
  })

  return allItems.slice(0, 100) // generous limit
}
