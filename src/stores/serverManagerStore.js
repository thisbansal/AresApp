import { create } from 'zustand'
import { DB_KINDS, getData, setData } from '../services/luna/lunaService'
import { getServers, getBestServerConnection } from '../services/plex/plexAPIServer'
import { useServerStore } from './serverStore'
import { useAppStore } from './AppStore'

const getCacheKey = (profileId = null) => {
  return `multiServerCache_global`
}

export const useServerManagerStore = create((set, get) => ({
  servers: {}, // Map of clientIdentifier -> { name, clientIdentifier, accessToken, uri, owned, lastTested }
  isDiscovering: false,

  // Load from persistent storage
  loadCachedServers: async (fallbackToken = null, profileId = null) => {
    try {
      const cached = await getData(DB_KINDS.SERVER, getCacheKey(profileId))
      if (cached) {
        console.group('[SERVER MANAGER] Restoring cached servers...')

        // Ensure owned servers use the correct active profile's token
        if (fallbackToken) {
          for (const key of Object.keys(cached)) {
            const s = cached[key]
            if (s.owned) {
              s.accessToken = fallbackToken
              console.log(`[Sync] Set owned server "${s.name}" token to active profile token.`)
            }
          }
        } else {
          console.warn('[SERVER MANAGER] loadCachedServers called without fallbackToken. Skipping sync check.')
        }

        console.groupEnd()
        set({ servers: cached })
        console.log('[SERVER MANAGER] Total cached servers loaded:', Object.keys(cached).length)
      }
    } catch (e) {
      console.error('[SERVER MANAGER] Failed to load cached servers:', e)
    }
  },

  // Save to persistent storage
  saveServersToCache: async (serversMap, profileId = null) => {
    try {
      await setData(DB_KINDS.SERVER, getCacheKey(profileId), serversMap)
    } catch (e) {
      console.error('[SERVER MANAGER] Failed to save servers cache:', e)
    }
  },

  getServer: (clientId) => {
    return get().servers[clientId] || null
  },

  // Discovers all servers via plex.tv, resolves best URIs, and caches them
  discoverAllServers: async (mainToken, profileId = null) => {
    if (!mainToken) return
    set({ isDiscovering: true })
    console.log('[SERVER MANAGER] Starting global server discovery...')

    try {
      // 1. Fetch all resources from plex.tv
      const allServers = await getServers(mainToken, { ownedOnly: false })

      const updatedServers = { ...get().servers }
      const promises = allServers.map(async (server) => {
        // 2. Resolve best URI for each server
        const bestUri = await getBestServerConnection(server, server.accessToken)
        if (bestUri) {
          updatedServers[server.clientIdentifier] = {
            name: server.name,
            clientIdentifier: server.clientIdentifier,
            accessToken: server.accessToken,
            uri: bestUri, // Currently active / fastest URI
            connections: server.connections, // Store all available URIs
            owned: server.owned,
            lastTested: Date.now()
          }
        }
      })

      // Wait for all health checks / probes to finish
      await Promise.allSettled(promises)

      console.group('[SERVER MANAGER] discoverAllServers: Saving to Store')
      console.groupEnd()

      // 3. Save to state and cache
      set({ servers: updatedServers, isDiscovering: false })
      await get().saveServersToCache(updatedServers, profileId)

      console.log(`[SERVER MANAGER] Discovery complete. Found ${Object.keys(updatedServers).length} reachable servers.`)

      // Optional: Auto-set active server for legacy components if none is set
      const currentActive = useServerStore.getState().activeServer
      if (!currentActive && Object.keys(updatedServers).length > 0) {
        const firstServer = Object.values(updatedServers).find(s => s.owned) || Object.values(updatedServers)[0]
        useServerStore.setState({
          activeServer: {
            uri: firstServer.uri,
            token: firstServer.accessToken,
            owned: firstServer.owned
          }
        })
      }

    } catch (e) {
      console.error('[SERVER MANAGER] Global discovery failed:', e)
      set({ isDiscovering: false })
    }
  }
}))
