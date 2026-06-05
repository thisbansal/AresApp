import { useState, useEffect } from 'react'
import { getActiveServerInfo } from '../services/plex/plexConnectionService'
import { useAppStore } from '../stores/AppStore'
import { useServerStore } from '../stores/serverStore'
import { useServerManagerStore } from '../stores/serverManagerStore'

/**
 * Custom hook to resolve active server credentials.
 * Automatically redirects to "/" if credentials cannot be resolved.
 * 
 * @param {Object} [initialServerInfo] - Optional initial server info from location state
 * @param {Function} [navigate] - React router navigate function
 * @returns {[Object|null, boolean]} Tuple containing resolved server info and loading state
 */
export function useActiveServer(initialServerInfo = null, navigate = null) {
  const storeToken = useAppStore(state => state.token)
  const activeServer = useServerStore(state => state.activeServer)
  const hasServers = Object.keys(useServerManagerStore(state => state.servers)).length > 0

  const [serverInfo, setServerInfo] = useState(initialServerInfo)
  const [loading, setLoading] = useState(!initialServerInfo)

  useEffect(() => {
    if (initialServerInfo?.uri && initialServerInfo?.token) {
      setServerInfo(initialServerInfo)
      setLoading(false)
      return
    }

    if (activeServer?.uri && activeServer?.token) {
      setServerInfo(activeServer)
      setLoading(false)
      return
    }
  }, [initialServerInfo, activeServer])

  useEffect(() => {
    if (serverInfo?.uri && serverInfo?.token) {
      setLoading(false)
      return
    }

    let active = true
    const resolveServer = async () => {
      try {
        const info = await getActiveServerInfo(serverInfo)
        if (active) {
          setServerInfo(info)
          setLoading(false)
        }
      } catch (err) {
        console.error('[useActiveServer] Failed to resolve active server info:', err)
        if (active) {
          setLoading(false)
          if (navigate) {
            navigate('/', { replace: true })
          }
        }
      }
    }

    resolveServer()

    return () => {
      active = false
    }
  }, [serverInfo, navigate, storeToken, hasServers])

  return [serverInfo, loading]
}
