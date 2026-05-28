import { useEffect, useRef } from 'react';
import { PLEX_CONFIG } from '../config/app';

export function useSidecarSubtitles(videoRef, availableStreams, serverInfo, ratingKey, clientSessionId) {
    const textTrackElementRef = useRef(null);

    useEffect(() => {
        const videoEl = videoRef.current || document.querySelector('video');
        if (!videoEl || !serverInfo || !ratingKey) return;

        // Find selected subtitle stream that is text-based
        const subtitleStream = availableStreams.find(s => s.streamType === 3 && s.selected);
        
        // If no subtitle selected, or it's image-based (which requires burn-in), clean up sidecar
        const codec = (subtitleStream?.codec || '').toLowerCase();
        const isTextBased = ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa'].includes(codec);

        if (!subtitleStream || !isTextBased) {
            cleanupSidecar(videoEl);
            return;
        }

        console.log(`[useSidecarSubtitles] Mounting native sidecar track via Plex Transcoder for ${subtitleStream.codec}...`);

        const ratingId = String(ratingKey).split('/').pop();
        const metadataPath = `/library/metadata/${ratingId}`;

        // Build the Plex Universal Transcoder URL specifically for the subtitle track
        const params = new URLSearchParams({
            'hasMDE': '1',
            'path': metadataPath,
            'mediaIndex': '0',
            'partIndex': '0',
            'protocol': 'http', // Critical: HTTP returns a continuous VTT file, whereas DASH returns an MPD
            'format': 'vtt',
            'fastSeek': '1',
            'directPlay': '0',
            'directStream': '1',
            'subtitles': 'auto',
            'advancedSubtitles': 'text',
            'session': clientSessionId || 'webapp-session',
            'subtitleStreamID': subtitleStream.id.toString(),
            'X-Plex-Token': serverInfo.token,
            'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
            'X-Plex-Platform': 'Chrome',
            'X-Plex-Product': PLEX_CONFIG.product
        });

        const vttUrl = `${serverInfo.uri}/video/:/transcode/universal/subtitles?${params.toString()}`;

        // Cleanup previous track
        cleanupSidecar(videoEl);
        
        // Inject the new track directly from the Transcoder
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = subtitleStream.extendedDisplayTitle || subtitleStream.displayTitle || 'Subtitle';
        track.srclang = subtitleStream.languageCode || 'en';
        track.src = vttUrl;
        track.default = true;
        
        videoEl.appendChild(track);
        textTrackElementRef.current = track;

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

        console.log(`[useSidecarSubtitles] Successfully mounted Transcoder sidecar track!`);

        return () => {
            cleanupSidecar(videoEl);
        };
    }, [videoRef, availableStreams, serverInfo, ratingKey, clientSessionId]);

    const cleanupSidecar = (videoEl) => {
        if (textTrackElementRef.current && videoEl && videoEl.contains(textTrackElementRef.current)) {
            videoEl.removeChild(textTrackElementRef.current);
        }
        textTrackElementRef.current = null;
    };
}
