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
            
            // If no subtitle selected, or it's image-based (which requires burn-in), clean up sidecar
            const codec = (subtitleStream?.codec || '').toLowerCase();
            const isTextBased = ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa'].includes(codec);

            if (!subtitleStream || !isTextBased) {
                cleanupSidecar();
                return;
            }

            console.log(`[useSidecarSubtitles] Fetching native sidecar track for ${subtitleStream.codec}...`);

            try {
                // Fetch the raw subtitle file from Plex
                const streamUrl = `${serverInfo.uri}/library/streams/${subtitleStream.id}?X-Plex-Token=${serverInfo.token}`;
                const response = await fetch(streamUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const rawContent = await response.text();
                
                // Convert to WebVTT
                const blobUrl = subtitleConverter.convertToVttBlobUrl(rawContent, codec);
                if (!blobUrl) {
                    throw new Error('Subtitle conversion failed');
                }

                // Cleanup previous track
                cleanupSidecar();
                
                // Inject the new track
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = subtitleStream.extendedDisplayTitle || subtitleStream.displayTitle || 'Subtitle';
                track.srclang = subtitleStream.languageCode || 'en';
                track.src = blobUrl;
                track.default = true;
                
                videoEl.appendChild(track);
                textTrackElementRef.current = track;
                activeTrackUrlRef.current = blobUrl;

                // Force video element to show it
                if (videoEl.textTracks && videoEl.textTracks.length > 0) {
                    // Turn off all other tracks natively just in case
                    for (let i = 0; i < videoEl.textTracks.length; i++) {
                        videoEl.textTracks[i].mode = 'disabled';
                    }
                    
                    // The appended track is usually the last one
                    const newTrack = videoEl.textTracks[videoEl.textTracks.length - 1];
                    if (newTrack) {
                        newTrack.mode = 'showing';
                    }
                }

                console.log(`[useSidecarSubtitles] Successfully mounted native sidecar track!`);

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
