# Plex Smart Transcoding Fallback

This document outlines the architecture and quirks of the Smart Codec-Aware Transcoding system implemented in this application.

## Overview
Plex Direct Play is always preferred for optimal performance. However, platforms like webOS and Chrome lack native support for certain high-end audio codecs (e.g., Dolby Digital Plus / EAC3) or video codecs (e.g., HEVC on older TVs). When a `<video>` tag encounters an unsupported codec, it throws a `NotSupportedError`.

To solve this, we implemented a smart fallback system that analyzes the selected media streams against the device's capabilities *before* playback begins, and dynamically negotiates a transcoding session with the Plex Media Server if necessary.

## Architecture

1. **`MediaCodecService.js`**: Analyzes the browser/TV's capabilities using `MediaSource.isTypeSupported()`. It checks the selected video and audio streams (e.g., `h264`, `eac3`) and returns a boolean indicating whether the device natively supports them.
2. **`plexStreamBuilder.js`**: Responsible for building the correct Plex URL.
   - If codecs are supported, it returns a Direct Play URL.
   - If codecs are unsupported, it falls back to the `/video/:/transcode/universal/start.m3u8` endpoint.
3. **`PlayerPage.jsx`**: Handles the UI layer. It intercepts stream loading and track switching, invokes the builder to get the optimal stream, and dynamically applies the correct `type` attribute to the `<source>` tag (`application/x-mpegURL` for HLS transcodes).

## The Transcoder Decision Pre-flight
Before passing the `.m3u8` playlist to the `<video>` element, `plexStreamBuilder.js` makes an asynchronous `fetch()` request to `/video/:/transcode/universal/decision`. 

### Why ping the Decision endpoint?
If you feed a bad HLS URL to a `<video>` element, it will fail silently or throw a generic network error, making it impossible to debug *why* Plex refused to transcode. By pinging the `/decision` endpoint with the exact same parameters first, we can catch HTTP 400 errors and explicitly log the reason Plex rejected the request to the browser console.

## Critical Quirks & Troubleshooting

### 1. The 400 Bad Request HTML Error
If the transcoder endpoint throws a raw `<html><head><title>Bad Request</title>...` error (instead of a Plex XML error), this means the underlying web server crashed the request before it reached the Media Decision Engine.
**Cause**: The `X-Plex-Platform` parameter.
Plex maps `X-Plex-Platform` to an internal XML "Transcoder Profile" (e.g. `webOS TV.xml`). If the profile does not exist on the server, the server panics and throws a 400 HTML error.
**Solution**: We explicitly hardcode `X-Plex-Platform: 'Chrome'` when requesting transcodes. Since webOS relies on a Chromium engine and every Plex Server ships with a `Chrome` profile, this guarantees maximum compatibility.

### 2. CORS Preflight Rejection
Older versions of Plex Media Server will instantly reject `OPTIONS` preflight requests to the transcoder endpoint. 
**Solution**: Never include custom headers (like `Accept: application/json`) in the `fetch()` request to the `/decision` endpoint. Keeping it a "Simple" GET request prevents the browser from sending a preflight request.

### 3. Track Switching
Whenever the user selects a new Audio or Subtitle track, the device capabilities must be re-evaluated. If the user switches from a supported `aac` track to an unsupported `eac3` track, the app will seamlessly swap the Direct Play URL for an HLS Transcode URL from the current playback offset.

### 4. Infinite Buffering on Transcode (Unsupported HLS Tags)
**Problem**: The WebOS TV native HLS parser explicitly rejects `EXT-X-MEDIA` tags (used by Plex for multiple audio/subtitle tracks). When the native `<video>` tag is fed the Plex transcoder `.m3u8`, the hardware decoder fails to parse it and silently aborts playback, resulting in an infinite buffer state.
**Solution**: We bypass the TV's native HLS parser completely using Media Source Extensions (MSE) via `hls.js`. The library fetches and parses the `.m3u8` manually in JavaScript, manages the complex tags correctly, and feeds raw compatible video buffers to the hardware decoder.

### 5. PlayQueues Stalling on TV
**Problem**: Our progress tracker relies on `videoRef.current.duration` to send timeline updates to Plex. When playing HLS transcodes, Smart TVs often report the `<video>` duration as `Infinity` or `NaN`. Sending `NaN` as the duration to the Plex API causes it to reject the timeline update, breaking PlayQueue sync.
**Solution**: We extract the exact `duration` (in milliseconds) directly from the Plex metadata in `PlayerPage.jsx` and pass it into the `usePlaybackProgress` hook to completely bypass the native player's faulty duration reporting.

## Configuration
This feature can be completely disabled for testing or internal debugging by toggling `enableSmartTranscoding: false` in `src/config/app.js`.

