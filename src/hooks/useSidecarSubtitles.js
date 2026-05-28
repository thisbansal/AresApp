import { useEffect, useRef } from 'react';
import { subtitleConverter } from '../utils/subtitleConverter';

export function useSidecarSubtitles(videoRef, availableStreams, serverInfo, partId) {
    const activeTrackUrlRef = useRef(null);
    const textTrackElementRef = useRef(null);

    useEffect(() => {
        const videoEl = videoRef.current || document.querySelector('video');
        if (!videoEl || !serverInfo) return;

        const loadSidecarSubtitle = async () => {
            // Find selected subtitle stream that is text-based
            const subtitleStream = availableStreams.find(s => s.streamType === 3 && s.selected);
            
            console.log(`[useSidecarSubtitles] Checking for active text-based subtitle track...`);
            
            // If no subtitle selected, or it's image-based (which requires burn-in), clean up sidecar
            const codec = (subtitleStream?.codec || '').toLowerCase();
            const isTextBased = ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa'].includes(codec);

            if (!subtitleStream) {
                console.log(`[useSidecarSubtitles] No subtitle track is currently selected. Cleaning up sidecar.`);
                cleanupSidecar();
                return;
            }

            if (!isTextBased) {
                console.log(`[useSidecarSubtitles] Selected subtitle (${codec}) is NOT text-based. It requires server burn-in. Cleaning up sidecar.`);
                cleanupSidecar();
                return;
            }

            console.log(`[useSidecarSubtitles] Selected subtitle is text-based (${subtitleStream.codec}). Fetching native sidecar track...`);

            try {
                // Fetch the raw subtitle file from Plex
                const streamUrl = `${serverInfo.uri}/library/streams/${subtitleStream.id}?X-Plex-Token=${serverInfo.token}`;
                console.log(`[useSidecarSubtitles] Executing fetch to URL: ${serverInfo.uri}/library/streams/${subtitleStream.id} (Token hidden)`);
                
                const response = await fetch(streamUrl);
                console.log(`[useSidecarSubtitles] Fetch response status: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                }
                
                const rawContent = await response.text();
                console.log(`[useSidecarSubtitles] Successfully downloaded raw subtitle content. Length: ${rawContent.length} characters.`);
                
                // Convert to WebVTT
                console.log(`[useSidecarSubtitles] Passing content to subtitleConverter for codec: ${codec}`);
                const blobUrl = subtitleConverter.convertToVttBlobUrl(rawContent, codec);
                if (!blobUrl) {
                    throw new Error('Subtitle conversion failed and returned null/undefined blob URL.');
                }
                console.log(`[useSidecarSubtitles] Subtitle converted successfully! Blob URL generated: ${blobUrl}`);

                // Cleanup previous track
                cleanupSidecar();
                
                // Inject the new track
                console.log(`[useSidecarSubtitles] Injecting <track> element into the video player DOM...`);
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = subtitleStream.extendedDisplayTitle || subtitleStream.displayTitle || 'Subtitle';
                track.srclang = subtitleStream.languageCode || 'en';
                track.src = blobUrl;
                track.default = true;
                
                videoEl.appendChild(track);
                textTrackElementRef.current = track;
                activeTrackUrlRef.current = blobUrl;
                console.log(`[useSidecarSubtitles] <track> element appended successfully.`);

                // Force video element to show it
                if (videoEl.textTracks && videoEl.textTracks.length > 0) {
                    console.log(`[useSidecarSubtitles] Found ${videoEl.textTracks.length} text tracks on video element. Forcing display mode...`);
                    // Turn off all other tracks natively just in case
                    for (let i = 0; i < videoEl.textTracks.length; i++) {
                        videoEl.textTracks[i].mode = 'disabled';
                    }
                    
                    // The appended track is usually the last one
                    const newTrack = videoEl.textTracks[videoEl.textTracks.length - 1];
                    if (newTrack) {
                        newTrack.mode = 'showing';
                        console.log(`[useSidecarSubtitles] Set active text track mode to 'showing'.`);
                    } else {
                        console.warn(`[useSidecarSubtitles] Failed to find the newly appended text track in videoEl.textTracks array!`);
                    }
                } else {
                    console.warn(`[useSidecarSubtitles] videoEl.textTracks is empty or undefined immediately after appending!`);
                }

                console.log(`[useSidecarSubtitles] Successfully mounted native sidecar track and completed pipeline!`);

            } catch (e) {
                console.error('[useSidecarSubtitles] Failed to fetch or mount sidecar subtitle:', e);
                cleanupSidecar();
            }
        };

        const cleanupSidecar = () => {
            if (textTrackElementRef.current && videoEl.contains(textTrackElementRef.current)) {
                videoEl.removeChild(textTrackElementRef.current);
            }
            if (activeTrackUrlRef.current) {
                URL.revokeObjectURL(activeTrackUrlRef.current);
            }
            textTrackElementRef.current = null;
            activeTrackUrlRef.current = null;
        };

        loadSidecarSubtitle();

        return () => {
            cleanupSidecar();
        };
    }, [videoRef, availableStreams, serverInfo, partId]);
}
