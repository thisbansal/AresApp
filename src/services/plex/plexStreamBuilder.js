import { PLEX_CONFIG } from '../../config/app'
import { getPlatformInfo } from '../../utils/platformInfo'

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
  async buildTranscodeUrl(serverInfo, ratingKey, partKey, playbackSessionId, clientSessionId, offset = 0, forceSubtitleBurnIn = false, capabilities = null) {
    const platformInfo = await getPlatformInfo();

    // Convert offset from milliseconds to seconds if greater than 0
    const offsetSeconds = offset > 0 ? Math.floor(offset / 1000) : 0

    const ratingId = ratingKey.split('/').pop()
    const metadataPath = `/library/metadata/${ratingId}`

    let profileExtra = '';
    if (capabilities) {
      const selectedVideo = capabilities.video.find(v => v.selected) || capabilities.video[0];
      // If HEVC is natively supported by the TV, explicitly inform Plex to allow Direct Stream
      if (selectedVideo && selectedVideo.supported && (selectedVideo.codec === 'hevc' || selectedVideo.codec === 'h265' || selectedVideo.codec === 'dovi')) {
        profileExtra = 'append-transcode-target-codec(type=videoProfile&context=streaming&protocol=dash&videoCodec=hevc)';
      }
    }

    // Construct the transcode query parameters
    const paramsObj = {
      'hasMDE': '1',
      'path': metadataPath,
      'mediaIndex': '0',
      'partIndex': '0',
      'protocol': 'dash',
      'transcodeType': 'video',
      'fastSeek': '1',
      'directPlay': '0',
      'directStream': '1', // Allow copying supported streams (e.g. video)
      'directStreamAudio': '1',
      'autoAdjustQuality': '0',
      'location': 'lan',
      'mediaBufferSize': '102400',
      'subtitles': forceSubtitleBurnIn ? 'burn' : 'auto',
      'advancedSubtitles': forceSubtitleBurnIn ? 'burn' : 'text', // Enum: 'burn', 'text', 'unknown'
      'subtitleSize': '100',
      'audioBoost': '100',
      'transcodeSessionId': playbackSessionId,
      'offset': offsetSeconds.toString(),
      'copyts': '1',
      'X-Plex-Token': serverInfo.token,
      'X-Plex-Session-Identifier': playbackSessionId,
      'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
      'X-Plex-Platform': platformInfo.platform,
      'X-Plex-Device': platformInfo.device,
      'X-Plex-Platform-Version': platformInfo.version,
      'X-Plex-Client-Profile-Name': 'HTML TV App',
      'X-Plex-Product': PLEX_CONFIG.product
    };

    if (profileExtra) {
      paramsObj['X-Plex-Client-Profile-Extra'] = profileExtra;
    }

    const params = new URLSearchParams(paramsObj);

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

    return `${serverInfo.uri}/video/:/transcode/universal/start.mpd?${params.toString()}`
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
    
    // Check if the selected subtitle is embedded (lacks a stream 'key')
    // As observed in Plex Web, the Transcoder engine MUST be active (Direct Streaming)
    // in order to extract an embedded text track via the /subtitles endpoint.
    const isEmbeddedSubtitle = selectedSubtitle && !selectedSubtitle.key;

    const videoSupported = selectedVideo ? selectedVideo.supported : true
    const audioSupported = selectedAudio ? selectedAudio.supported : true
    
    // We no longer fallback to burn-in automatically if a subtitle is unsupported.
    // The user explicitly requested that burn-in is strictly manual via the HUD toggle.
    // "Be they visible or not that would be not sidecar's responsibility."
    const needsBurnIn = arguments[7] === true;

    if (videoSupported && audioSupported && !needsBurnIn && !isEmbeddedSubtitle) {
      console.log('[PlexStreamBuilder] Codecs fully supported and no embedded subtitles selected. Strategy: DIRECT PLAY')
      return this.buildDirectPlayUrl(serverInfo, part.key)
    }

    console.log(`[PlexStreamBuilder] Strategy: TRANSCODE (VideoSupported: ${videoSupported}, AudioSupported: ${audioSupported}, NeedsBurnIn: ${needsBurnIn}, EmbeddedSubtitle: ${!!isEmbeddedSubtitle})`)
    return await this.buildTranscodeUrl(serverInfo, ratingKey, part.key, playbackSessionId, clientSessionId, offset, needsBurnIn, capabilities)
  }
}

export const plexStreamBuilder = new PlexStreamBuilder()
export default PlexStreamBuilder
