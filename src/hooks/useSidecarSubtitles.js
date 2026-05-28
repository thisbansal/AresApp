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
                // Determine the fetch URL. External sidecars usually have an explicit 'key'.
                // If missing, we fallback to the Plex API standard stream extraction path with the codec extension (e.g. .srt)
                // This fallback path sometimes works for "On Demand" blob subtitles, though it will throw 501 for embedded MKV tracks.
                let streamPath = subtitleStream.key;
                if (!streamPath) {
                    streamPath = `/library/streams/${subtitleStream.id}.${codec}`;
                    console.log(`[useSidecarSubtitles] Subtitle stream ${subtitleStream.id} is missing a 'key' property. Attempting fallback extraction path: ${streamPath}`);
                }
                
                const streamUrl = `${serverInfo.uri}${streamPath}?X-Plex-Token=${serverInfo.token}`;
                console.log(`[useSidecarSubtitles] Executing fetch to URL: ${serverInfo.uri}${streamPath} (Token hidden)`);
                
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

                // The browser takes a moment to load the blob. Enforce showing once loaded.
                track.onload = () => {
                    console.log(`[useSidecarSubtitles] <track> Blob parsed natively! Enforcing mode = 'showing'`);
                    if (track.track) {
                        track.track.mode = 'showing';
                    }
                };

                // Aggressive enforcement: Smart TVs and Hls.js frequently override native textTracks
                // We will use an interval to continuously monitor and enforce our injected track's visibility.
                const enforceVisibility = setInterval(() => {
                    if (videoEl.textTracks && videoEl.textTracks.length > 0) {
                        // Find our explicitly injected track (it has our blob URL)
                        // In some browsers, track objects lose their original reference, so we hunt by label
                        let found = false;
                        for (let i = 0; i < videoEl.textTracks.length; i++) {
                            const t = videoEl.textTracks[i];
                            if (t.label === track.label) {
                                found = true;
                                if (t.mode !== 'showing') {
                                    console.log(`[useSidecarSubtitles] Native engine disabled our track! Re-enforcing 'showing'...`);
                                    t.mode = 'showing';
                                }
                            } else {
                                // Mute competing tracks (e.g. ones generated by Hls.js)
                                if (t.mode === 'showing') t.mode = 'hidden';
                            }
                        }
                    }
                }, 500);

                // Store interval so we can clear it
                textTrackElementRef.current._enforcerInterval = enforceVisibility;

                console.log(`[useSidecarSubtitles] Successfully mounted native sidecar track and completed pipeline!`);

            } catch (e) {
                console.error('[useSidecarSubtitles] Failed to fetch or mount sidecar subtitle:', e);
                cleanupSidecar();
            }
        };

        const cleanupSidecar = () => {
            if (textTrackElementRef.current) {
                if (textTrackElementRef.current._enforcerInterval) {
                    clearInterval(textTrackElementRef.current._enforcerInterval);
                }
                if (videoEl.contains(textTrackElementRef.current)) {
                    videoEl.removeChild(textTrackElementRef.current);
                }
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
