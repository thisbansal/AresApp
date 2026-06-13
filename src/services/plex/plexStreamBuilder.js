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
   * Generates a Universal Transcode DASH URL and pings the decision endpoint to validate.
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
      if (selectedVideo && selectedVideo.supported && (selectedVideo.codec === 'hevc' || selectedVideo.codec === 'h265' || selectedVideo.codec === 'dovi')) {
        // We bypass strict MediaSource.isTypeSupported checks here because Safari's implementation is notorious 
        // for returning false negatives for HEVC MSE. Since selectedVideo.supported (which uses <video>.canPlayType) 
        // returned true, we trust that the underlying OS can decode it.
        
        // Use the exact advanced limitations from Plex Web to force Plex to allow HEVC remuxing in DASH
        const hevcLimits = [
          'add-limitation(scope=videoCodec&scopeName=hevc&type=upperBound&name=video.width&value=4096&replace=true)',
          'add-limitation(scope=videoCodec&scopeName=hevc&type=upperBound&name=video.height&value=2160&replace=true)',
          'add-limitation(scope=videoCodec&scopeName=hevc&type=upperBound&name=video.bitDepth&value=10&replace=true)',
          'append-transcode-target-codec(type=videoProfile&context=streaming&protocol=dash&videoCodec=hevc)',
          'add-limitation(scope=videoTranscodeTarget&scopeName=hevc&scopeType=videoCodec&context=streaming&protocol=dash&type=match&name=video.colorTrc&list=bt709|bt470m|bt470bg|smpte170m|smpte240m|bt2020-10|smpte2084&isRequired=false)',
          'append-transcode-target-codec(type=videoProfile&context=streaming&videoCodec=hevc,h264&audioCodec=aac&protocol=dash)'
        ];
        profileExtra = hevcLimits.join('+');
      }

      // Check if the browser supports AC3/EAC3 (Dolby Digital) natively. WebOS TVs do, Chrome Desktop does not.
      const isAc3Supported = typeof MediaSource !== 'undefined' &&
        (MediaSource.isTypeSupported('audio/mp4; codecs="ac-3"') ||
         MediaSource.isTypeSupported('audio/mp4; codecs="ec-3"'));

      if (!isAc3Supported) {
        const audioFallback = 'append-transcode-target-codec(type=audioProfile&context=streaming&protocol=dash&audioCodec=aac)';
        profileExtra = profileExtra ? `${profileExtra}+${audioFallback}` : audioFallback;
        console.log('[plexStreamBuilder] Browser lacks AC3/EAC3 MSE support. Forcing AAC audio transcode.');
      }
    }

    const streamProtocol = 'dash';

    // Construct the transcode query parameters
    const paramsObj = {
      'hasMDE': '1',
      'path': metadataPath,
      'mediaIndex': '0',
      'partIndex': '0',
      'protocol': streamProtocol,
      'transcodeType': 'video',
      'fastSeek': '1',
      'directPlay': '0',
      'directStream': '1', // Allow copying supported streams (e.g. video)
      'directStreamAudio': '1',
      'autoAdjustQuality': '0',
      'location': 'lan',
      'mediaBufferSize': '1024000', // Allow the Plex server to buffer up to 100MB ahead for smooth streaming
      'subtitles': forceSubtitleBurnIn ? 'burn' : (capabilities && capabilities.subtitles?.some(s => s.selected && s.id !== 0) ? 'auto' : 'none'),
      'advancedSubtitles': forceSubtitleBurnIn ? 'burn' : 'text', // Enum: 'burn', 'text', 'unknown'
      'subtitleSize': '100',
      'audioBoost': '100',
      'videoResolution': '3840x2160', // Prevent Plex from defaulting to 1080p downscaling for 4K media
      'transcodeSessionId': playbackSessionId,
      'offset': offsetSeconds.toString(),
      'copyts': '0',
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

    const videoSupported = selectedVideo ? selectedVideo.supported : true
    const audioSupported = selectedAudio ? selectedAudio.supported : true

    // We no longer fallback to burn-in automatically if a subtitle is unsupported.
    // The user explicitly requested that burn-in is strictly manual via the HUD toggle.
    // "Be they visible or not that would be not sidecar's responsibility."
    const needsBurnIn = arguments[7] === true;

    let imageBasedSubtitleSelected = false
    let isForcedBurnIn = needsBurnIn

    if (selectedSubtitle) {
      const imageCodecs = ['pgs', 'vobsub', 'dvb_subtitle', 'dvd_subtitle']
      if (imageCodecs.includes(selectedSubtitle.codec?.toLowerCase())) {
        imageBasedSubtitleSelected = true
        isForcedBurnIn = true // We MUST burn in image-based subtitles
      }
    }

    const platformInfo = await getPlatformInfo();
    const isMkv = part?.container === 'mkv';
    // Currently, only webOS TVs natively support MKV containers reliably.
    // Desktop browsers (Safari, Chrome) will fail on partial fetches for MKV, requiring a DASH remux.
    const containerSupported = isMkv ? (platformInfo.platform === 'webOS') : true;

    // Only force Transcode if we NEED burn-in, OR if an image-based subtitle is selected (which MUST be burned in),
    // OR if the media container itself (like MKV) is unsupported by the current browser.
    if (videoSupported && audioSupported && containerSupported && !isForcedBurnIn) {
      console.log('[PlexStreamBuilder] Codecs and container fully supported. Strategy: DIRECT PLAY')
      return this.buildDirectPlayUrl(serverInfo, part.key)
    }

    console.log(`[PlexStreamBuilder] Strategy: TRANSCODE (VideoSupported: ${videoSupported}, AudioSupported: ${audioSupported}, ContainerSupported: ${containerSupported}, NeedsBurnIn: ${isForcedBurnIn}, ImageSubtitle: ${imageBasedSubtitleSelected})`)
    return await this.buildTranscodeUrl(serverInfo, ratingKey, part.key, playbackSessionId, clientSessionId, offset, isForcedBurnIn, capabilities)
  }

  buildSubtitleStreamUrl(serverInfo, ratingKey, partKey, playbackSessionId, clientSessionId, capabilities) {
    if (!serverInfo || !partKey) return null;

    const paramsObj = {
      hasMDE: 1,
      path: ratingKey,
      mediaIndex: 0,
      partIndex: 0,
      protocol: 'dash',
      fastSeek: 1,
      directPlay: 0,
      directStream: 0,
      subtitleSize: 100,
      audioBoost: 100,
      location: 'lan',
      session: clientSessionId,
      directStreamAudio: 0,
      subtitles: 'auto',
      advancedSubtitles: 'text',
      'Accept-Language': 'en',
      'X-Plex-Session-Identifier': clientSessionId,
      'X-Plex-Incomplete-Segments': 1,
      'X-Plex-Product': 'Plex Web',
      'X-Plex-Version': '4.159.0',
      'X-Plex-Client-Identifier': serverInfo.clientIdentifier || 'ares-webos-client',
      'X-Plex-Platform': 'Chrome',
      'X-Plex-Platform-Version': '148.0',
      'X-Plex-Features': 'external-media,indirect-media,hub-style-list',
      'X-Plex-Model': 'standalone',
      'X-Plex-Device': 'OSX',
      'X-Plex-Device-Name': 'Chrome',
      'X-Plex-Device-Screen-Resolution': '1920x1080',
      'X-Plex-Token': serverInfo.token,
      'X-Plex-Language': 'en',
      'X-Plex-Session-Id': playbackSessionId,
      'X-Plex-Playback-Session-Id': playbackSessionId,
    };

    // Reconstruct the profile extra string to avoid [object Object]
    let profileExtra = '';
    if (capabilities) {
      const selectedVideo = capabilities.video.find(v => v.selected) || capabilities.video[0];
      const isHevcSupported = typeof MediaSource !== 'undefined' &&
        (MediaSource.isTypeSupported('video/mp4; codecs="hev1"') ||
         MediaSource.isTypeSupported('video/mp4; codecs="hvc1"'));

      if (selectedVideo && selectedVideo.supported && (selectedVideo.codec === 'hevc' || selectedVideo.codec === 'h265' || selectedVideo.codec === 'dovi')) {
        if (isHevcSupported) {
          profileExtra = 'append-transcode-target-codec(type=videoProfile&context=streaming&protocol=dash&videoCodec=hevc)';
        }
      }
    }

    if (profileExtra) {
      paramsObj['X-Plex-Client-Profile-Extra'] = profileExtra;
    }

    const params = new URLSearchParams(paramsObj);

    return `${serverInfo.uri}/video/:/transcode/universal/subtitles?${params.toString()}`;
  }

  /**
   * Constructs the official LG HTTP Subtitle Extraction URL.
   */
  buildOfficialSidecarUrl(serverInfo, ratingKey, playbackSessionId, offset = 0, isDecision = false) {
    if (!serverInfo || !ratingKey) return null;

    const ratingId = ratingKey.split('/').pop()
    const metadataPath = `/library/metadata/${ratingId}`
    const offsetSeconds = offset > 0 ? Math.floor(offset / 1000) : 0

    const paramsObj = {
      'directPlay': '1',
      'directStream': '1',
      'directStreamAudio': '1',
      'protocol': isDecision ? 'dash' : 'http',
      'fastSeek': '1',
      'path': metadataPath,
      'session': playbackSessionId,
      'mediaIndex': '0',
      'partIndex': '0',
      'mediaBufferSize': '50000',
      'hasMDE': '1',
      'subtitleSize': '100',
      'videoQuality': '100',
      'videoResolution': '3840x2160',
      'audioBoost': '100',
      'autoAdjustSubtitle': '1',
      'subtitles': 'sidecar',
      'location': 'lan',
      'copyts': '1',
      'offset': offsetSeconds.toString(),
      'X-Plex-Token': serverInfo.token,
      'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
      'X-Plex-Session-Identifier': playbackSessionId,
      'X-Plex-Product': PLEX_CONFIG.product,
      'X-Plex-Platform': 'webOS',
      'X-Plex-Client-Profile-Name': 'Generic',
      'X-Plex-Client-Profile-Extra': 'add-transcode-target(type=subtitleProfile&protocol=http&context=all&subtitleCodec=vtt&container=vtt)'
    };

    const params = new URLSearchParams(paramsObj);
    if (isDecision) {
      return `${serverInfo.uri}/video/:/transcode/universal/decision?${params.toString()}`;
    } else {
      return `${serverInfo.uri}/subtitles/:/transcode/universal/start?${params.toString()}`;
    }
  }

  /**
   * Pings the /decision endpoint to initialize a background transcode session for sidecar extraction.
   */
  async pingSidecarDecision(serverInfo, ratingKey, playbackSessionId, offset = 0) {
    const decisionUrl = this.buildOfficialSidecarUrl(serverInfo, ratingKey, playbackSessionId, offset, true);
    if (!decisionUrl) return false;

    const headers = this.getOfficialSidecarHeaders(serverInfo, playbackSessionId);

    try {
      console.log(`[PlexStreamBuilder] Pinging Sidecar Decision endpoint...`);
      const response = await fetch(decisionUrl, { headers });
      if (!response.ok) {
        console.error(`[PlexStreamBuilder] Sidecar Decision failed: ${response.status}`);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`[PlexStreamBuilder] Error pinging sidecar decision:`, e);
      return false;
    }
  }

  /**
   * Returns the headers required to successfully fetch the official sidecar subtitle.
   */
  getOfficialSidecarHeaders(serverInfo, playbackSessionId) {
    return {
      'Accept': 'application/json, */*',
      'X-Plex-Token': serverInfo.token,
      'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
      'X-Plex-Product': PLEX_CONFIG.product,
      'X-Plex-Platform': 'webOS',
      'X-Plex-Session-Id': playbackSessionId,
      'X-Plex-Client-Profile-Name': 'Generic',
      'X-Plex-Client-Profile-Extra': 'add-transcode-target(type=subtitleProfile&protocol=http&context=all&subtitleCodec=srt&container=srt)'
    };
  }

  /**
   * Explicitly stops a background sidecar transcode session on the Plex server to prevent zombies.
   * This frees up the client's transcode slot so rapid toggling doesn't throw 400 Bad Request.
   */
  async stopSidecarSession(serverInfo, sidecarSessionId) {
    if (!serverInfo || !sidecarSessionId) return;
    const stopUrl = `${serverInfo.uri}/video/:/transcode/universal/stop?session=${sidecarSessionId}&X-Plex-Token=${serverInfo.token}&X-Plex-Client-Identifier=${PLEX_CONFIG.clientId}`;
    try {
      console.log(`[PlexStreamBuilder] Stopping sidecar session to free slot: ${sidecarSessionId}`);
      await fetch(stopUrl, { method: 'GET' });
    } catch (e) {
      console.error(`[PlexStreamBuilder] Failed to stop sidecar session:`, e);
    }
  }
}

export const plexStreamBuilder = new PlexStreamBuilder()
export default PlexStreamBuilder
