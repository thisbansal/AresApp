import { plexBridge } from './plexBridge'
import { useAppStore } from '../../stores/AppStore'
import { useServerStore } from '../../stores/serverStore'

/**
 * Build optimized image URL with specific size and format
 */
export const buildImageUrl = (serverUri, path, token, width = 400, height = 600, format = 'jpeg') => {
  if (!path) return null
  const separator = path.includes('?') ? '&' : '?'

  const imgToken = token
  const innerUrl = `${serverUri}${path}${separator}X-Plex-Token=${imgToken}`

  const activeServer = useServerStore.getState().activeServer
  const isShared = activeServer && activeServer.owned === false
  const userProfile = useAppStore.getState().userProfile

  // Use the explicitly provided token for image transcode authorization
  const transcodeToken = token

  // WebOS TVs often struggle with WebP or complex formats, forcing jpeg ensures compatibility for posters/art.
  // We use png specifically when transparency is required (e.g. clearLogos)
  return `${serverUri}/photo/:/transcode?url=${path}&width=${width}&height=${height}&minSize=1&upscale=1&format=${format}&X-Plex-Token=${transcodeToken}`
}

export const extractClearLogo = (item) => {
  if (Array.isArray(item.Image)) {
    const logoImg = item.Image.find(i => i.type === 'clearLogo')
    if (logoImg && logoImg.url) return logoImg.url
  }
  // Fallback for some versions of plex where it might be exposed differently
  if (item.clearLogo) return item.clearLogo
  if (item.titleArt) return item.titleArt
  return null
}

const buildServerContext = (serverUri, token) => ({ uri: serverUri, token })

/**
 * Get all libraries from the Plex server
 */
export const getLibraries = async (serverUri, token) => {
  const response = await plexBridge.request('/library/sections', {}, buildServerContext(serverUri, token))
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
    ? `/library/sections/${libraryId}/recentlyAdded?includeExtras=1&includeGuids=1&includeAdvanced=1`
    : '/library/recentlyAdded?includeExtras=1&includeGuids=1&includeAdvanced=1'

  const response = await plexBridge.request(endpoint, {}, buildServerContext(serverUri, token))
  const data = await response.json()

  const items = (data.MediaContainer.Metadata || []).slice(0, limit).map(item => ({
    id: item.ratingKey,
    title: item.title,
    type: item.type,
    year: item.year,
    thumb: buildImageUrl(serverUri, item.thumb, token, 400, 600), // Grid thumbnail
    rawThumb: item.thumb,
    art: buildImageUrl(serverUri, item.art || item.grandparentArt || item.parentArt, token, 800, 450), // Detail view
    rawArt: item.art || item.grandparentArt || item.parentArt,
    logo: buildImageUrl(serverUri, extractClearLogo(item), token, 600, 300, 'png'),
    rawLogo: extractClearLogo(item),
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
  const response = await plexBridge.request('/library/onDeck?includeExtras=1&includeGuids=1&includeAdvanced=1', {}, buildServerContext(serverUri, token))
  const data = await response.json()

  const items = (data.MediaContainer.Metadata || []).slice(0, limit).map(item => ({
    id: item.ratingKey,
    title: item.title,
    type: item.type,
    year: item.year,
    thumb: buildImageUrl(serverUri, item.type === 'episode' ? (item.grandparentThumb || item.thumb) : item.thumb, token, 400, 600),
    rawThumb: item.type === 'episode' ? (item.grandparentThumb || item.thumb) : item.thumb,
    art: buildImageUrl(serverUri, item.art || item.grandparentArt || item.parentArt, token, 800, 450),
    rawArt: item.art || item.grandparentArt || item.parentArt,
    logo: buildImageUrl(serverUri, extractClearLogo(item), token, 600, 300, 'png'),
    rawLogo: extractClearLogo(item),
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
  const response = await plexBridge.request(`/library/sections/${libraryId}/all?includeExtras=1&includeGuids=1&includeAdvanced=1`, {}, buildServerContext(serverUri, token))
  const data = await response.json()

  const items = (data.MediaContainer.Metadata || []).map(item => ({
    id: item.ratingKey,
    title: item.title,
    type: item.type,
    year: item.year,
    thumb: buildImageUrl(serverUri, item.thumb, token, 400, 600),
    rawThumb: item.thumb,
    logo: buildImageUrl(serverUri, extractClearLogo(item), token, 600, 300, 'png'),
    rawLogo: extractClearLogo(item),
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
    logo: buildImageUrl(serverUri, extractClearLogo(item), token, 600, 300, 'png'),
    rawLogo: extractClearLogo(item),
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
    grandparentTitle: item.grandparentTitle,
    parentTitle: item.parentTitle,
    parentIndex: item.parentIndex,
    index: item.index,
    viewOffset: item.viewOffset,
    viewCount: item.viewCount,
    markers: item.Marker?.map(m => ({
      type: m.type,
      startTimeOffset: m.startTimeOffset,
      endTimeOffset: m.endTimeOffset
    })) || [],
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
          index: s.index,
          key: s.key,
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

/**
 * Remove a specific item from the Continue Watching (On Deck) hub 
 * without modifying its overall watched/unwatched state.
 */
export const removeFromContinueWatching = async (serverUri, token, ratingKey) => {
  await plexBridge.request(
    `/actions/removeFromContinueWatching?ratingKey=${ratingKey}`,
    { method: 'PUT' }, // PUT is standard for actions, but we can also use GET depending on PMS version. Let's try PUT since actions modify state. Wait, the docs say /actions/removeFromContinueWatching?key= or ratingKey=.
    buildServerContext(serverUri, token)
  )
  return true
}

