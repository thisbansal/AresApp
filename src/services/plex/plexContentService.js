// Plex API service for fetching media content - OPTIMIZED FOR TV PERFORMANCE

/**
 * Build optimized image URL with specific size and format
 * For grid view: 200x300 WebP images load ~10x faster than full-res JPEGs
 */
const buildImageUrl = (serverUri, path, token, width = 200, height = 300) => {
  if (!path) return null
  // Optimizations:
  // - Smaller dimensions (200x300 instead of 300x450)
  // - WebP format (smaller file size)
  // - minSize=1 (allow smaller than requested)
  // - upscale=0 (don't upscale small images)
  return `${serverUri}${path}?X-Plex-Token=${token}&width=${width}&height=${height}&minSize=1&upscale=0&format=webp`
}

/**
 * Get all libraries from the Plex server
 */
export const getLibraries = async (serverUri, token) => {
  try {
    const url = `${serverUri}/library/sections/all`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': token
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch libraries: ${response.status}`)
    }

    const data = await response.json()
    // Parse library data
    const libraries = data.MediaContainer.Directory.map(lib => ({
      id: lib.key,
      uuid: lib.uuid,
      title: lib.title,
      type: lib.type,
      agent: lib.agent,
      scanner: lib.scanner,
      language: lib.language,
      updatedAt: lib.updatedAt,
      itemCount: lib.Location?.[0]?.id || 0,
      thumb: buildImageUrl(serverUri, lib.thumb, token, 150, 150),
      art: buildImageUrl(serverUri, lib.art, token, 600, 350),
    }))

    return libraries
  } catch (error) {
    console.error('Error fetching libraries:', error)
    throw error
  }
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
      throw new Error(`Failed to fetch recently added: ${response.status}`)
    }

    const data = await response.json()

    // Parse media items with optimized image sizes
    const items = (data.MediaContainer.Metadata || []).slice(0, limit).map(item => ({
      id: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: buildImageUrl(serverUri, item.thumb, token, 200, 300), // Grid thumbnail
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
    }))

    return items
  } catch (error) {
    console.error('Error fetching recently added:', error)
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
      throw new Error(`Failed to fetch on deck: ${response.status}`)
    }

    const data = await response.json()

    const items = (data.MediaContainer.Metadata || []).slice(0, limit).map(item => ({
      id: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: buildImageUrl(serverUri, item.thumb, token, 200, 300),
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
    throw error
  }
}

/**
 * Get library items (all content from a specific library)
 * OPTIMIZED: Returns small thumbnails for grid view
 */
export const getLibraryItems = async (serverUri, token, libraryId, options = {}) => {
  try {
    const {
      start = 0,
      size = 50,
      sort = 'titleSort:asc',
      unwatched = false
    } = options

    let url = `${serverUri}/library/sections/${libraryId}/all?X-Plex-Token=${token}`
    url += `&X-Plex-Container-Start=${start}`
    url += `&X-Plex-Container-Size=${size}`
    url += `&sort=${sort}`

    if (unwatched) {
      url += '&unwatched=1'
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': token,
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch library items: ${response.status}`)
    }

    const data = await response.json()

    // Use SMALL thumbnails for grid view - this is key for performance!
    const items = (data.MediaContainer.Metadata || []).map(item => ({
      id: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: buildImageUrl(serverUri, item.thumb, token, 200, 300), // Small for grid
      thumbLarge: buildImageUrl(serverUri, item.thumb, token, 400, 600), // Large for detail
      art: buildImageUrl(serverUri, item.art, token, 800, 450),
      rating: item.contentRating,
      summary: item.summary,
      duration: item.duration,
      viewCount: item.viewCount,
      lastViewedAt: item.lastViewedAt,
    }))

    return {
      items,
      total: data.MediaContainer.totalSize,
      size: data.MediaContainer.size,
    }
  } catch (error) {
    console.error('Error fetching library items:', error)
    throw error
  }
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
    throw error
  }
}

/**
 * Helper to get library type icon
 */
export const getLibraryIcon = (type) => {
  const icons = {
    movie: '🎬',
    show: '📺',
    artist: '🎵',
    photo: '📷',
  }
  return icons[type] || '📁'
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