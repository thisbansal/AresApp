import { useState, useEffect } from 'react'
import { getActiveServerInfo } from '../services/plex/plexConnectionService'

/**
 * Custom hook to resolve active server credentials.
 * Automatically redirects to "/" if credentials cannot be resolved.
 * 
 * @param {Object} [initialServerInfo] - Optional initial server info from location state
 * @param {Function} [navigate] - React router navigate function
 * @returns {[Object|null, boolean]} Tuple containing resolved server info and loading state
 */
export function useActiveServer(initialServerInfo = null, navigate = null) {
  const [serverInfo, setServerInfo] = useState(initialServerInfo)
  const [loading, setLoading] = useState(!initialServerInfo)

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
  }, [serverInfo, navigate])

  return [serverInfo, loading]
}
