import { plexBridge } from './plexBridge'
import { useAppStore } from '../../stores/AppStore'
import { useServerStore } from '../../stores/serverStore'

/**
 * Build optimized image URL with specific size and format
 */
const buildImageUrl = (serverUri, path, token, width = 400, height = 600) => {
  if (!path) return null
  const separator = path.includes('?') ? '&' : '?'
  
  const imgToken = token
  const innerUrl = `${serverUri}${path}${separator}X-Plex-Token=${imgToken}`

  const activeServer = useServerStore.getState().activeServer
  const isShared = activeServer && activeServer.owned === false
  const mainToken = useAppStore.getState().mainToken

  if (isShared && mainToken) {
    // For shared servers, use the global plex.tv proxy transcoder to avoid 401s
    return `https://images.plex.tv/photo?url=${encodeURIComponent(innerUrl)}&width=${width}&height=${height}&format=jpeg&X-Plex-Token=${mainToken}`
  }

  // Use the admin/main token for image transcode authorization if available, fallback to the current session token
  const transcodeToken = useAppStore.getState().mainToken || token
  const transcodeInnerUrl = `${serverUri}${path}${separator}X-Plex-Token=${transcodeToken}`

  // WebOS TVs often struggle with WebP or complex formats, forcing jpeg ensures compatibility
  return `${serverUri}/photo/:/transcode?url=${encodeURIComponent(transcodeInnerUrl)}&width=${width}&height=${height}&format=jpeg&X-Plex-Token=${transcodeToken}`
}

const buildServerContext = (serverUri, token) => ({ uri: serverUri, token })

/**
 * Get all libraries from the Plex server
 */
export const getLibraries = async (serverUri, token) => {
  const response = await plexBridge.request('/library/sections/all', {}, buildServerContext(serverUri, token))
  const data = await response.json()

  return data.MediaContainer.Directory
    .filter(lib => lib.type !== 'photo')
    .map(lib => ({
      id: lib.key,
      title: lib.title,
      type: lib.type,
    }))
}

/**
 * Get recently added items from a specific library
 */
export const getRecentlyAdded = async (serverUri, token, libraryId = null, limit = 20) => {
  const endpoint = libraryId
    ? `/library/sections/${libraryId}/recentlyAdded`
    : '/library/recentlyAdded'

  const response = await plexBridge.request(endpoint, {}, buildServerContext(serverUri, token))
  const data = await response.json()

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
    grandparentRatingKey: item.grandparentRatingKey,
    parentRatingKey: item.parentRatingKey,
    // View state
    viewCount: item.viewCount,
    viewOffset: item.viewOffset,
    viewedLeafCount: item.viewedLeafCount,
    leafCount: item.leafCount,
  }))

  return items
}

/**
 * Get on deck (continue watching) items
 */
export const getOnDeck = async (serverUri, token, limit = 20) => {
  const response = await plexBridge.request('/library/onDeck', {}, buildServerContext(serverUri, token))
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
    grandparentRatingKey: item.grandparentRatingKey,
    parentRatingKey: item.parentRatingKey,
  }))

  return items
}

/**
 * Get library items (all content from a specific library)
 * OPTIMIZED: Returns small thumbnails for grid view
 */
export const getLibraryItems = async (serverUri, token, libraryId) => {
  const response = await plexBridge.request(`/library/sections/${libraryId}/all`, {}, buildServerContext(serverUri, token))
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
  const response = await plexBridge.request(`/library/metadata/${ratingKey}`, {}, buildServerContext(serverUri, token))
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
    grandparentRatingKey: item.grandparentRatingKey,
    parentRatingKey: item.parentRatingKey,
    viewOffset: item.viewOffset,
    viewCount: item.viewCount,
    media: item.Media?.map(m => ({
      videoResolution: m.videoResolution,
      bitrate: m.bitrate,
      audioChannels: m.audioChannels,
      audioCodec: m.audioCodec,
      videoCodec: m.videoCodec,
      container: m.container,
      duration: m.duration,
      parts: m.Part?.map(p => ({
        id: p.id,
        file: p.file,
        size: p.size,
        duration: p.duration,
        key: p.key,
        streams: p.Stream?.map(s => ({
          id: s.id,
          streamType: s.streamType,
          codec: s.codec,
          language: s.language,
          languageCode: s.languageCode,
          displayTitle: s.displayTitle,
          extendedDisplayTitle: s.extendedDisplayTitle,
          selected: !!s.selected,
          default: !!s.default,
          channels: s.channels,
          bitrate: s.bitrate
        })) || []
      })) || []
    })) || []
  }
}

/**
 * Get children for a specific item (e.g. Seasons for a Show, Episodes for a Season)
 */
export const getChildren = async (serverUri, token, ratingKey) => {
  const response = await plexBridge.request(`/library/metadata/${ratingKey}/children`, {}, buildServerContext(serverUri, token))
  const data = await response.json()
  
  const items = (data.MediaContainer.Metadata || []).map(item => ({
    id: item.ratingKey,
    title: item.title,
    type: item.type,
    year: item.year,
    index: item.index,
    parentIndex: item.parentIndex,
    thumb: buildImageUrl(serverUri, item.thumb, token, 400, 600),
    rating: item.contentRating,
    summary: item.summary,
    viewCount: item.viewCount,
    viewOffset: item.viewOffset,
    viewedLeafCount: item.viewedLeafCount,
    leafCount: item.leafCount,
  }))

  return items
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

/**
 * Mark a specific item as watched (scrobble) on Plex
 */
export const markAsWatched = async (serverUri, token, ratingKey) => {
  await plexBridge.request(
    `/:/scrobble?key=${ratingKey}&identifier=com.plexapp.plugins.library`,
    { method: 'GET' },
    buildServerContext(serverUri, token)
  )
  return true
}

/**
 * Mark a specific item as unwatched (unscrobble) on Plex
 */
export const markAsUnwatched = async (serverUri, token, ratingKey) => {
  await plexBridge.request(
    `/:/unscrobble?key=${ratingKey}&identifier=com.plexapp.plugins.library`,
    { method: 'GET' },
    buildServerContext(serverUri, token)
  )
  return true
}
