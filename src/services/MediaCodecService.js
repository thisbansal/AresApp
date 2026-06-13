import { useBrowserStore } from '../stores/browserStore';

class MediaCodecService {
    constructor() {
        // Create a detached video element to use for testing codec capabilities
        this.videoElement = document.createElement('video');
    }

    /**
     * Map common stream codecs to standard MIME types for testing.
     * @param {string} codec - The codec string from metadata (e.g., 'hevc', 'h264', 'eac3', 'aac')
     * @param {string} type - 'video' or 'audio'
     * @returns {string} - The mime type string for canPlayType testing
     */
    getMimeTypeForCodec(codec, type) {
        if (!codec) return '';
        codec = codec.toLowerCase();

        if (type === 'video') {
            switch (codec) {
                case 'hevc':
                case 'h265':
                    // Safari highly prefers hvc1 over hev1 for its canPlayType verification
                    return 'video/mp4; codecs="hvc1"';
                case 'h264':
                    // Generic H.264 profile for testing
                    return 'video/mp4; codecs="avc1.42E01E"';
                case 'vp9':
                    return 'video/webm; codecs="vp9"';
                case 'av1':
                    return 'video/mp4; codecs="av01.0.05M.08"';
                default:
                    return `video/mp4; codecs="${codec}"`;
            }
        } else if (type === 'audio') {
            switch (codec) {
                case 'eac3':
                    // Dolby Digital Plus
                    return 'audio/mp4; codecs="ec-3"';
                case 'ac3':
                    // Dolby Digital
                    return 'audio/mp4; codecs="ac-3"';
                case 'aac':
                    // Advanced Audio Coding
                    return 'audio/mp4; codecs="mp4a.40.2"';
                case 'flac':
                    return 'audio/flac';
                case 'opus':
                    return 'audio/ogg; codecs="opus"';
                case 'mp3':
                    return 'audio/mpeg';
                case 'truehd':
                    return 'audio/mp4; codecs="mlpa"'; // Varies, TrueHD is notoriously unsupported in web
                default:
                    return `audio/mp4; codecs="${codec}"`;
            }
        }
        return '';
    }

    /**
     * Checks support for the provided media metadata streams.
     * @param {Object} streamData - The stream metadata object (e.g., from Plex/Jellyfin)
     * @returns {Object} - Results mapping of supported and unsupported codecs
     */
    checkStreamCapabilities(streamData) {
        const results = {
            video: [],
            audio: [],
            subtitles: []
        };

        console.group('--- Media Codec Capabilities Check ---');

        if (streamData.video && Array.isArray(streamData.video)) {
            streamData.video.forEach(v => {
                const mimeType = this.getMimeTypeForCodec(v.codec, 'video');
                const canPlay = this.videoElement.canPlayType(mimeType);
                const supported = canPlay === 'probably' || canPlay === 'maybe';

                results.video.push({
                    id: v.id,
                    codec: v.codec,
                    mimeType,
                    canPlayValue: canPlay,
                    supported,
                    selected: v.selected
                });

                const logMessage = `Video [${v.codec}] - ${v.extendedDisplayTitle || v.displayTitle}`;
                if (supported) {
                    console.log(`✅ SUPPORTED: ${logMessage} (canPlayType: '${canPlay}')`);
                } else {
                    console.error(`❌ NOT SUPPORTED: ${logMessage} (canPlayType: '${canPlay}')`);
                }
            });
        }

        if (streamData.audio && Array.isArray(streamData.audio)) {
            const enableAudioPassthrough = useBrowserStore.getState().enableAudioPassthrough;
            
            streamData.audio.forEach(a => {
                const codecLower = (a.codec || '').toLowerCase();
                const isPassthroughCodec = ['ac3', 'eac3', 'dca', 'dts', 'truehd'].includes(codecLower);
                const mimeType = this.getMimeTypeForCodec(a.codec, 'audio');
                let canPlay = this.videoElement.canPlayType(mimeType);
                let supported = canPlay === 'probably' || canPlay === 'maybe';

                // Override with passthrough if enabled and codec is high-end audio
                if (enableAudioPassthrough && isPassthroughCodec) {
                    supported = true;
                    canPlay = 'passthrough-override';
                }

                results.audio.push({
                    id: a.id,
                    codec: a.codec,
                    mimeType,
                    canPlayValue: canPlay,
                    supported,
                    selected: a.selected
                });

                const logMessage = `Audio [${a.codec}] - ${a.extendedDisplayTitle || a.displayTitle}`;
                if (supported) {
                    console.log(`✅ SUPPORTED: ${logMessage} (canPlayType: '${canPlay}')`);
                } else {
                    console.error(`❌ NOT SUPPORTED: ${logMessage} (canPlayType: '${canPlay}')`);
                }
            });
        }

        if (streamData.subtitles && Array.isArray(streamData.subtitles)) {
            streamData.subtitles.forEach(s => {
                // Determine if subtitle is text-based (natively renderable via track/HLS) or image-based (requires burn-in)
                const codec = (s.codec || '').toLowerCase();
                const isTextBased = ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa', 'mov_text', 'tx3g'].includes(codec);

                // Plex ONLY provides a 'key' property if the subtitle is an external sidecar file.
                // If there is no key, it is embedded inside the MKV container, which means we CANNOT
                // fetch it cleanly via /library/streams/. Therefore, it must be transcoded!
                const isExternal = !!s.key;
                const isSupported = isTextBased && isExternal;

                results.subtitles.push({
                    id: s.id,
                    codec: s.codec,
                    isTextBased,
                    isExternal,
                    supported: isSupported,
                    selected: s.selected,
                    key: s.key
                });

                const logMessage = `Subtitle [${s.codec}] - ${s.extendedDisplayTitle || s.displayTitle || s.language}`;
                if (isSupported) {
                    console.log(`✅ SUPPORTED: ${logMessage} (Format: Text, External)`);
                } else {
                    console.error(`❌ NOT SUPPORTED (Requires Burn-in): ${logMessage} (Format: ${isTextBased ? 'Text' : 'Image'}, External: ${isExternal})`);
                }
            });
        }

        console.groupEnd();

        return results;
    }

}

export const mediaCodecService = new MediaCodecService();
export default MediaCodecService;
