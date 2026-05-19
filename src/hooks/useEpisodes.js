import { useState, useEffect } from 'react'
import { getChildren } from '../services/plex/plexContentService'

/**
 * Custom hook to load and cache season episodes.
 * 
 * @param {Object} serverInfo - Resolved server info containing uri and token
 * @param {string|number} seasonId - The rating key of the season
 * @returns {[Array, Function, boolean]} Tuple containing episode list, updater function, and loading state
 */
export function useEpisodes(serverInfo, seasonId) {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!serverInfo?.uri || !serverInfo?.token || !seasonId) {
      setEpisodes([])
      return
    }

    let active = true
    const fetchEpisodes = async () => {
      setLoading(true)
      try {
        const children = await getChildren(serverInfo.uri, serverInfo.token, seasonId)
        if (active) {
          setEpisodes(children)
        }
      } catch (err) {
        console.error('[useEpisodes] Failed to fetch episodes:', err)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchEpisodes()

    return () => {
      active = false
    }
  }, [serverInfo, seasonId])

  return [episodes, setEpisodes, loading]
}
