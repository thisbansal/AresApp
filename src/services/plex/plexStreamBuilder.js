import { PLEX_CONFIG } from '../../config/app'

class PlexStreamBuilder {
  /**
   * Generates a simple Direct Play URL.
   * @param {Object} serverInfo 
   * @param {string} partKey 
   * @returns {string} The absolute URL for direct play
   */
  buildDirectPlayUrl(serverInfo, partKey) {
    return `${serverInfo.uri}${partKey}?X-Plex-Token=${serverInfo.token}`
  }

  /**
   * Generates a Universal Transcode HLS URL and pings the decision endpoint to validate.
   * @param {Object} serverInfo 
   * @param {string} ratingKey 
   * @param {string} partKey
   * @param {string} playbackSessionId - Persistent UI playback session UUID
   * @param {string} clientSessionId - Persistent client session UUID
   * @param {number} offset - Current playback time in milliseconds
   * @param {boolean} forceSubtitleBurnIn - Whether to force Plex to burn subtitles into the video
   * @returns {Promise<string>} The transcode m3u8 URL
   */
  async buildTranscodeUrl(serverInfo, ratingKey, partKey, playbackSessionId, clientSessionId, offset = 0, forceSubtitleBurnIn = false) {
    // Convert offset from milliseconds to seconds if greater than 0
    const offsetSeconds = offset > 0 ? Math.floor(offset / 1000) : 0

    const ratingId = ratingKey.split('/').pop()
    const metadataPath = `/library/metadata/${ratingId}`

    // Construct the transcode query parameters
    const params = new URLSearchParams({
      'hasMDE': '1',
      'path': metadataPath,
      'mediaIndex': '0',
      'partIndex': '0',
      'protocol': 'hls',
      'fastSeek': '1',
      'directPlay': '0',
      'directStream': '1', // Allow copying supported streams (e.g. video)
      'directStreamAudio': '1',
      'autoAdjustQuality': '0',
      'location': 'lan',
      'mediaBufferSize': '102400',
      'subtitles': forceSubtitleBurnIn ? 'burn' : 'auto',
      'advancedSubtitles': forceSubtitleBurnIn ? 'none' : 'text',
      'subtitleSize': '100',
      'audioBoost': '100',
      'session': clientSessionId,
      'offset': offsetSeconds.toString(),
      'copyts': '1',
      'X-Plex-Token': serverInfo.token,
      'X-Plex-Session-Id': clientSessionId,
      'X-Plex-Playback-Session-Id': playbackSessionId,
      'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
      // CRITICAL: Plex Media Server will throw a 400 HTML error if it doesn't have a 
      // transcoder profile for the specified platform. We MUST use 'Chrome' instead of 
      // PLEX_CONFIG.device ('webOS TV') because all PMS instances ship with a Chrome profile.
      'X-Plex-Platform': 'Chrome',
      'X-Plex-Product': PLEX_CONFIG.product
    })

    const decisionUrl = `${serverInfo.uri}/video/:/transcode/universal/decision?${params.toString()}`
    
    try {
      console.log(`[PlexStreamBuilder] Pinging transcode decision endpoint:`, decisionUrl)
      // Send fetch without extra headers to avoid CORS preflight rejection from older PMS servers
      const response = await fetch(decisionUrl)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[PlexStreamBuilder] Transcode Decision failed with status ${response.status}:`, errorText)
        throw new Error(`Plex Transcoder rejected parameters: ${response.status}`)
      }
      
      console.log(`[PlexStreamBuilder] Transcode Decision OK.`)
    } catch (err) {
      console.error(`[PlexStreamBuilder] Error hitting transcode decision:`, err)
      throw err
    }

    return `${serverInfo.uri}/video/:/transcode/universal/start.m3u8?${params.toString()}`
  }

  /**
   * Determines the optimal stream URL (Direct Play vs Transcode) based on capabilities and config.
   * @param {Object} serverInfo - The active server details
   * @param {Object} part - The media part object (from Plex metadata)
   * @param {string} ratingKey - The item rating key
   * @param {Object} capabilities - Result object from MediaCodecService.checkStreamCapabilities
   * @param {string} playbackSessionId - Persistent UI playback session UUID
   * @param {string} clientSessionId - Persistent client session UUID
   * @param {number} offset - Playback offset in ms
   * @returns {Promise<string>} The optimal URL to feed to the video player
   */
  async getOptimalStreamUrl(serverInfo, part, ratingKey, capabilities, playbackSessionId, clientSessionId, offset = 0) {
    // If feature flag is off, always fallback to classic direct play
    if (!PLEX_CONFIG.features?.enableSmartTranscoding) {
      console.log('[PlexStreamBuilder] Smart transcoding disabled by config. Using Direct Play.')
      return this.buildDirectPlayUrl(serverInfo, part.key)
    }

    // Check if the currently selected video and audio streams are supported
    const selectedVideo = capabilities.video.find(v => v.selected) || capabilities.video[0]
    const selectedAudio = capabilities.audio.find(a => a.selected) || capabilities.audio[0]
    
    // Check if any subtitle is explicitly selected (id > 0)
    // In Plex, 'none' usually means no subtitle is selected, or it's absent from the payload.
    const selectedSubtitle = capabilities.subtitles ? capabilities.subtitles.find(s => s.selected && s.id !== 0) : null

    const videoSupported = selectedVideo ? selectedVideo.supported : true
    const audioSupported = selectedAudio ? selectedAudio.supported : true
    
    // For Direct Play, we can natively render text-based external sidecar subtitles via our Sidecar injection hook.
    // However, if the subtitle is image-based (PGS/VOBSUB) OR embedded inside the MKV container,
    // we MUST force a transcode to burn it in.
    const subtitleSupported = !selectedSubtitle || (selectedSubtitle.supported === true)

    if (videoSupported && audioSupported && subtitleSupported) {
      console.log('[PlexStreamBuilder] Codecs fully supported and no subtitles forced. Strategy: DIRECT PLAY')
      return this.buildDirectPlayUrl(serverInfo, part.key)
    }

    console.log(`[PlexStreamBuilder] Strategy: TRANSCODE (VideoSupported: ${videoSupported}, AudioSupported: ${audioSupported}, SubtitlesForced: ${!subtitleSupported})`)
    return await this.buildTranscodeUrl(serverInfo, ratingKey, part.key, playbackSessionId, clientSessionId, offset, !subtitleSupported)
  }
}

export const plexStreamBuilder = new PlexStreamBuilder()
export default PlexStreamBuilder
