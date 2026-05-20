import { useState, useEffect } from 'react'
import { getActiveServerInfo } from '../services/plex/plexConnectionService'
import { useAppStore } from '../stores/AppStore'

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
  const storeServerUri = useAppStore(state => state.serverUri)
  const storeIsLoading = useAppStore(state => state.isLoading)

  const [serverInfo, setServerInfo] = useState(initialServerInfo)
  const [loading, setLoading] = useState(!initialServerInfo)

  useEffect(() => {
    if (initialServerInfo?.uri && initialServerInfo?.token) {
      setServerInfo(initialServerInfo)
      setLoading(false)
      return
    }

    if (!storeIsLoading && storeToken && storeServerUri) {
      setServerInfo({ uri: storeServerUri, token: storeToken })
      setLoading(false)
      return
    }
  }, [initialServerInfo, storeToken, storeServerUri, storeIsLoading])

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
  }, [serverInfo, navigate, storeToken, storeServerUri, storeIsLoading])

  return [serverInfo, loading]
}
