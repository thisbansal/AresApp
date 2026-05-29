import { useEffect, useState } from 'react';
import { subtitleConverter } from '../utils/subtitleConverter';
import { parseVtt } from '../utils/vttParser';
import { PLEX_CONFIG } from '../config/app';
import { getPlatformInfo } from '../utils/platformInfo';

export function useSidecarSubtitles(videoRef, availableStreams, serverInfo, partId, ratingKey, playbackSessionId) {
    const [cues, setCues] = useState([]);

    useEffect(() => {
        if (!serverInfo) return;

        let isMounted = true;

        const loadSidecarSubtitle = async () => {
            // Find selected subtitle stream that is text-based
            const subtitleStream = availableStreams.find(s => s.streamType === 3 && s.selected);
            
            console.log(`[useSidecarSubtitles] Checking for active text-based subtitle track...`);
            
            const codec = (subtitleStream?.codec || '').toLowerCase();
            const isTextBased = ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa'].includes(codec);

            if (!subtitleStream || !isTextBased) {
                console.log(`[useSidecarSubtitles] No valid text-based subtitle track selected. Clearing cues.`);
                if (isMounted) setCues([]);
                return;
            }

            console.log(`[useSidecarSubtitles] Subtitle track selected (${subtitleStream.codec || 'unknown'}). Fetching payload for custom renderer...`);

            try {
                let streamUrl;
                
                if (subtitleStream.key || subtitleStream.codec === 'srt' || subtitleStream.codec === 'vtt') {
                    // External Sidecar Subtitle (or explicitly text-based file)
                    let streamPath = subtitleStream.key;
                    if (!streamPath) {
                        streamPath = `/library/streams/${subtitleStream.id}.${codec}`;
                        console.log(`[useSidecarSubtitles] Subtitle stream is missing 'key'. Attempting fallback path: ${streamPath}`);
                    }
                    streamUrl = `${serverInfo.uri}${streamPath}?X-Plex-Token=${serverInfo.token}`;
                    console.log(`[useSidecarSubtitles] Using sidecar extraction path: ${streamUrl}`);
                } else {
                    // Embedded Subtitle - Request extraction via Transcoder
                    console.log(`[useSidecarSubtitles] Track is embedded. Requesting dynamic extraction via Plex Transcoder...`);
                    const platformInfo = await getPlatformInfo();
                    const ratingId = ratingKey.split('/').pop();
                    
                    // Plex requires a unique 24-character alphanumeric transcode session ID
                    const transcodeSessionId = Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
                    
                    const paramsObj = {
                      'hasMDE': '1',
                      'path': `/library/metadata/${ratingId}`,
                      'mediaIndex': '0',
                      'partIndex': '0',
                      'protocol': 'http',
                      'fastSeek': '1',
                      'directPlay': '0',
                      'directStream': '1',
                      'subtitleSize': '100',
                      'audioBoost': '100',
                      'location': 'lan',
                      'session': transcodeSessionId,
                      'subtitles': 'auto',
                      'advancedSubtitles': 'text',
                      'X-Plex-Session-Identifier': playbackSessionId || 'unknown',
                      'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
                      'X-Plex-Platform': platformInfo.platform,
                      'X-Plex-Device': platformInfo.device,
                      'X-Plex-Platform-Version': platformInfo.version,
                      'X-Plex-Client-Profile-Name': 'HTML TV App',
                      'X-Plex-Product': PLEX_CONFIG.product,
                      'X-Plex-Token': serverInfo.token
                    };
                    
                    const params = new URLSearchParams(paramsObj);
                    streamUrl = `${serverInfo.uri}/video/:/transcode/universal/subtitles?${params.toString()}`;
                }
                
                // Give the Plex Server a brief moment to update its database with the new subtitle selection
                // before we ask the transcoder to extract it, preventing a race condition.
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const response = await fetch(streamUrl);
                console.log(`[useSidecarSubtitles] Fetch response status: ${response.status}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const rawContent = await response.text();
                
                // 1. Convert any SRT/ASS format into standard WebVTT format string
                // But instead of turning it into a blob URL, we just ask for the string
                // Wait, subtitleConverter currently only exports convertToVttBlobUrl.
                // We will modify it or just extract the VTT string before it blobs it.
                // Actually, I should update subtitleConverter to expose `convertToVttString`.
                
                const vttString = subtitleConverter.convertToVttString ? subtitleConverter.convertToVttString(rawContent, codec) : null;
                
                if (!vttString) {
                    throw new Error('Failed to convert subtitle to VTT string.');
                }

                // 2. Parse the VTT string into an array of {start, end, text}
                const parsedCues = parseVtt(vttString);
                console.log(`[useSidecarSubtitles] Parsed ${parsedCues.length} cues for custom renderer.`);
                
                if (isMounted) {
                    setCues(parsedCues);
                }

            } catch (e) {
                console.error('[useSidecarSubtitles] Failed to fetch or parse sidecar subtitle:', e);
                if (isMounted) setCues([]);
            }
        };

        loadSidecarSubtitle();

        return () => {
            isMounted = false;
        };
    }, [availableStreams, serverInfo, partId]);

    // Continuously enforce native text tracks are muted so we never get double subtitles
    useEffect(() => {
        const videoEl = videoRef.current || document.querySelector('video');
        if (!videoEl) return;

        const muteInterval = setInterval(() => {
            if (videoEl.textTracks && videoEl.textTracks.length > 0) {
                for (let i = 0; i < videoEl.textTracks.length; i++) {
                    if (videoEl.textTracks[i].mode === 'showing') {
                        videoEl.textTracks[i].mode = 'hidden';
                    }
                }
            }
        }, 500);

        return () => clearInterval(muteInterval);
    }, [videoRef]);

    return cues;
}
