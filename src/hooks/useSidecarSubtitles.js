import { useEffect, useState } from 'react';
import { subtitleConverter } from '../utils/subtitleConverter';
import { parseVtt } from '../utils/vttParser';

export function useSidecarSubtitles(videoRef, availableStreams, serverInfo, partId) {
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
                console.log(`[useSidecarSubtitles] No valid text-based track selected. Clearing cues.`);
                if (isMounted) setCues([]);
                return;
            }

            console.log(`[useSidecarSubtitles] Selected subtitle is text-based (${subtitleStream.codec}). Fetching for custom renderer...`);

            try {
                let streamPath = subtitleStream.key;
                if (!streamPath) {
                    streamPath = `/library/streams/${subtitleStream.id}.${codec}`;
                    console.log(`[useSidecarSubtitles] Subtitle stream ${subtitleStream.id} is missing a 'key' property. Attempting fallback extraction path: ${streamPath}`);
                }
                
                const streamUrl = `${serverInfo.uri}${streamPath}?X-Plex-Token=${serverInfo.token}`;
                
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

    return cues;
}
