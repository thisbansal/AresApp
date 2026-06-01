# Plex Subtitle Architecture — React WebOS Client
## Implementation Guide (v3.0.0)

---

## Overview

Handling subtitles correctly on a WebOS Smart TV connected to a Plex Media Server requires extreme precision to avoid 400 Bad Request collisions, zombie transcoders, and hardware video pipeline crashes.

Our application architecture relies on three different rendering paths depending on the media protocol, and completely separates **Subtitle Stream Parsing** from **Subtitle UI Visibility** to provide a zero-latency, Netflix-style UX.

---

## 1. Subtitle Rendering Paths

All subtitle logic is encapsulated and routed by `SubtitleManagerFactory.js`.

### A. DASH In-Band Subtitles (Transcoded Video)
When the video itself is transcoding via DASH (`protocol=dash`), Plex multiplexes the subtitle directly into the DASH manifest as a `TextTrack`. 
- **Handler:** `NativeTextTrackSubtitleHandler.js`
- **Mechanism:** We attach a listener to `shakaPlayer.getTextTracks()`. We hide the native OS subtitles (`mode = 'hidden'`) and pipe the cue events (`cuechange`) into our custom React overlay.
- **WebOS Quirk:** Calling `track.mode = 'hidden'` synchronously during video startup causes a fatal `Shaka 3015` MSE crash on LG TVs. We defer this mutation by 1000ms.

### B. Direct Play Sidecar Subtitles (Direct Video, Embedded Subs)
When the video is Direct Playing (e.g. raw MKV) but the user selects an embedded SRT or PGS track, Plex spins up a lightweight "Subtitle Transcoder" session to extract the track and serve it as a VTT HTTP stream.
- **Handler:** `VttStreamSubtitleHandler.js`
- **Mechanism:** We ping the Plex `/decision` endpoint to spin up a Sidecar Transcoder, then use the fetch `ReadableStream` API to parse the incoming VTT chunks in real-time, syncing them to the absolute video time.
- **Plex Quirk:** Plex limits transcoder slots. If a user toggles subtitles rapidly, Plex blocks the request (`400 Bad Request`) because the old session is still alive in the background. We circumvent this by generating unique session UUIDs and firing an explicit `/:/transcode/universal/stop` command on cleanup.

### C. Forced Burn-In
If the TV cannot render the subtitle format (e.g. complex ASS), we set `advancedSubtitles=burn` and `subtitles=burn`. Plex burns the subtitles directly into the video frames.
- **Handler:** `null` (No handler needed, video frames contain the text).

---

## 2. Netflix-Style Zero-Latency UX

Instead of constantly spinning Plex transcoders up and down when a user toggles subtitles off, we use a continuous background stream.

### Visibility vs. Selection
1. **Stream Selection:** Tells Plex *which* language track to extract (e.g., English). This involves a network request to Plex (`setStreamSelection`).
2. **Visibility (`isSubtitleVisible`):** A purely local React state. If the user clicks "Disable Subtitles", we leave the Plex stream running in the background but set `opacity: 0` on the `SubtitleOverlay.jsx`. When they click "Enable", they appear instantly with zero latency.

### Auto-Selection Engine
To make this seamless UX possible, the background sidecar stream must already be running even if the user hasn't turned subtitles on yet.
- In `PlayerPage.jsx`, when the media loads, we check if Plex has a subtitle selected.
- If **None** is selected, we scan the available streams for the best English text-based subtitle (`eng` SRT/VTT).
- We quietly issue a `setStreamSelection` API call to select it, spinning up the Sidecar transcoder in the background.
- We initialize `isSubtitleVisible` to `false`. 
- If the user later clicks "Enable Subtitles", they instantly appear.

---

## 3. Architecture Blueprint

```text
src/
├── routes/
│   └── PlayerPage.jsx                   # Orchestrator: UI, Auto-selection, Visibility State
├── components/media/
│   └── SubtitleOverlay.jsx              # React Ref Component (Updates DOM imperatively for 60fps)
├── services/plex/
│   ├── plexStreamBuilder.js             # Generates unique sidecar URLs & ping/stop commands
│   └── subtitles/
│       ├── SubtitleManagerFactory.js    # Routes to correct handler (Native vs VttStream)
│       ├── NativeTextTrackSubtitleHandler.js # Hooks Shaka DASH TextTracks -> SubtitleOverlay
│       └── VttStreamSubtitleHandler.js  # Parses HTTP ReadableStream -> SubtitleOverlay
```

---

## 4. UI Layer (`PlayerPage.jsx`)

The HUD stream selection menu is divided into two sections by a horizontal line:
1. **Master Toggle:** `Enable Subtitles` / `Disable Subtitles` (Toggles local `isVisible` state).
2. **Track List:** Clicking a language track (e.g., Spanish) triggers a network request to change the stream, and forces `isVisible` to `true`.
