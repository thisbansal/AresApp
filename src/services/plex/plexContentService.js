import { useNotificationStore } from '../notifications/notificationStore'

/**
 * Build optimized image URL with specific size and format
 */
const buildImageUrl = (serverUri, path, token, width = 400, height = 600) => {
  if (!path) return null
  const separator = path.includes('?') ? '&' : '?'
  const innerUrl = `${serverUri}${path}${separator}X-Plex-Token=${token}`
  // WebOS TVs often struggle with WebP or complex formats, forcing jpeg ensures compatibility
  return `${serverUri}/photo/:/transcode?url=${encodeURIComponent(innerUrl)}&width=${width}&height=${height}&format=jpeg&X-Plex-Token=${token}`
}

/**
 * Get all libraries from the Plex server
 */
export const getLibraries = async (serverUri, token) => {
  console.log('📚 [getLibraries] Fetching libraries from:', serverUri)
  const url = `${serverUri}/library/sections/all`
  console.log(`url: ${url}`)

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Plex-Token': token
    }
  })

  if (!response.ok) {
    useNotificationStore.getState().addNotification(`API Error: ${response.status} - /library/sections/all`, { level: 'dev' })
    throw new Error(`Failed to fetch libraries: ${response.status}`)
  }

  const data = await response.json()
  console.log('📚 [getLibraries] Raw response:', data)

  return data.MediaContainer.Directory
    .filter(lib => lib.type !== 'photo')
    .map(lib => ({
      id: lib.key,
      title: lib.title,
      type: lib.type,
      // thumb: buildImageUrl(serverUri, lib.thumb, token, 100, 100),
    }))
}

/**
 * Get recently added items from a specific library
 */
export const getRecentlyAdded = async (serverUri, token, libraryId = null, limit = 20) => {
  try {
    // If no library specified, get from all libraries
    const endpoint = libraryId
      ? `/library/sections/${libraryId}/recentlyAdded`
      : '/library/recentlyAdded'

    const url = `${serverUri}${endpoint}?X-Plex-Token=${token}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      useNotificationStore.getState().addNotification(`API Error: ${response.status} - ${endpoint}`, { level: 'dev' })
      throw new Error(`Failed to fetch recently added: ${response.status}`)
    }

    const data = await response.json()

    // Parse media items with optimized image sizes
    const items = (data.MediaContainer.Metadata || []).slice(0, limit).map(item => ({
      id: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: buildImageUrl(serverUri, item.thumb, token, 400, 600), // Grid thumbnail
      art: buildImageUrl(serverUri, item.art, token, 800, 450), // Detail view
      rating: item.contentRating,
      summary: item.summary,
      duration: item.duration,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
      // For TV shows
      grandparentTitle: item.grandparentTitle,
      parentTitle: item.parentTitle,
      index: item.index,
      parentIndex: item.parentIndex,
      // View state
      viewCount: item.viewCount,
      viewOffset: item.viewOffset,
      viewedLeafCount: item.viewedLeafCount,
      leafCount: item.leafCount,
    }))

    return items
  } catch (error) {
    console.error('Error fetching recently added:', error)
    useNotificationStore.getState().addNotification(`Network Error: ${error.message}`, { level: 'dev' })
    throw error
  }
}

/**
 * Get on deck (continue watching) items
 */
export const getOnDeck = async (serverUri, token, limit = 20) => {
  try {
    const url = `${serverUri}/library/onDeck?X-Plex-Token=${token}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      useNotificationStore.getState().addNotification(`API Error: ${response.status} - /library/onDeck`, { level: 'dev' })
      throw new Error(`Failed to fetch on deck: ${response.status}`)
    }

    const data = await response.json()

    const items = (data.MediaContainer.Metadata || []).slice(0, limit).map(item => ({
      id: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: buildImageUrl(serverUri, item.type === 'episode' ? (item.grandparentThumb || item.thumb) : item.thumb, token, 400, 600),
      art: buildImageUrl(serverUri, item.art, token, 800, 450),
      viewOffset: item.viewOffset,
      duration: item.duration,
      grandparentTitle: item.grandparentTitle,
      parentTitle: item.parentTitle,
      index: item.index,
      parentIndex: item.parentIndex,
    }))

    return items
  } catch (error) {
    console.error('Error fetching on deck:', error)
    useNotificationStore.getState().addNotification(`Network Error: ${error.message}`, { level: 'dev' })
    throw error
  }
}

/**
 * Get library items (all content from a specific library)
 * OPTIMIZED: Returns small thumbnails for grid view
 */
export const getLibraryItems = async (serverUri, token, libraryId) => {

  const url = `${serverUri}/library/sections/${libraryId}/all`
  console.log(`gettingItems: ${url}`)

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Plex-Token': token,
    }
  })

  if (!response.ok) {
    useNotificationStore.getState().addNotification(`API Error: ${response.status} - /library/sections/${libraryId}/all`, { level: 'dev' })
    throw new Error(`Failed to fetch library items: ${response.status}`)
  }

  const data = await response.json()


  const items = (data.MediaContainer.Metadata || []).map(item => ({
    id: item.ratingKey,
    title: item.title,
    type: item.type,
    year: item.year,
    thumb: buildImageUrl(serverUri, item.thumb, token, 400, 600),
    rating: item.contentRating,
    summary: item.summary,
    // View state
    viewCount: item.viewCount,
    viewOffset: item.viewOffset,
    viewedLeafCount: item.viewedLeafCount,
    leafCount: item.leafCount,
  }))

  return items
}

/**
 * Get detailed metadata for a specific item
 */
export const getMetadata = async (serverUri, token, ratingKey) => {
  try {
    const url = `${serverUri}/library/metadata/${ratingKey}?X-Plex-Token=${token}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      useNotificationStore.getState().addNotification(`API Error: ${response.status} - /library/metadata/${ratingKey}`, { level: 'dev' })
      throw new Error(`Failed to fetch metadata: ${response.status}`)
    }

    const data = await response.json()
    const item = data.MediaContainer.Metadata[0]

    return {
      id: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: buildImageUrl(serverUri, item.thumb, token, 400, 600), // Larger for detail view
      art: buildImageUrl(serverUri, item.art, token, 1280, 720), // Full art for background
      rating: item.contentRating,
      summary: item.summary,
      duration: item.duration,
      studio: item.studio,
      tagline: item.tagline,
      genres: item.Genre?.map(g => g.tag) || [],
      directors: item.Director?.map(d => d.tag) || [],
      writers: item.Writer?.map(w => w.tag) || [],
      actors: item.Role?.map(r => ({ name: r.tag, role: r.role, thumb: r.thumb })) || [],
      media: item.Media?.map(m => ({
        videoResolution: m.videoResolution,
        bitrate: m.bitrate,
        audioChannels: m.audioChannels,
        audioCodec: m.audioCodec,
        videoCodec: m.videoCodec,
        container: m.container,
        duration: m.duration,
        parts: m.Part?.map(p => ({
          file: p.file,
          size: p.size,
          duration: p.duration,
          key: p.key,
        })) || []
      })) || []
    }
  } catch (error) {
    console.error('Error fetching metadata:', error)
    useNotificationStore.getState().addNotification(`Network Error: ${error.message}`, { level: 'dev' })
    throw error
  }
}


/**
 * Helper to format duration (milliseconds to readable time)
 */
export const formatDuration = (ms) => {
  if (!ms) return ''

  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}