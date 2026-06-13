# Application Architecture & Guidelines
This document consolidates all core architectural patterns, performance constraints, and Plex-specific quirks for this application. ALL AGENTS working on this project MUST adhere to these guidelines.

## [Document: TV_DESIGN_AND_PERFORMANCE_GUIDELINES.md]

# Smart TV Design & CSS Performance Guidelines

This document details the architectural guidelines, UI constraints, and CSS performance rules for the WebOS Smart TV application. All future development and styling changes must strictly adhere to these patterns.

---

## 1. The 10-Foot UI Design Pattern

Smart TV applications are viewed from a distance of approximately 10 feet (3 meters) using a physical remote control D-pad. The UI must be optimized for visibility, readability, and navigation under these conditions.

### Safe Areas & Layout margins
* **Overscan Margins**: TV screens often clip the outer edges of the display. Always keep critical interactive UI elements inside a **5% to 8% safe area margin** (e.g., minimum `60px` horizontal and vertical padding from screen edges).
* **Grid Spacing**: Use spacious gaps (minimum `30px` to `40px` between cards and rows) to keep the screen organized and easy to parse at a glance.

### Typography Constraints
* **Minimum Font Size**: Text must be highly legible. Never use font sizes below `18px`.
  * **Primary Titles / Headings**: `40px` to `76px`
  * **Card Titles / Secondary Titles**: `24px` to `32px`
  * **Subtext / Descriptions**: `20px` to `24px`
* **Font Family**: Use modern sans-serif typefaces (e.g., `'Outfit'`, `'Inter'`) with generous letter-spacing for readability.

### Focus State Design
* **Visual Distinctness**: Interactive items must have an unmistakable focus state (a thick border, a bright accent color, or a scale-up transition).
* **No Mouse/Hover Assumptions**: The UI must be fully navigable via keyboard arrow keys/D-pad. Hover styles (`:hover`) should only complement focus states (`.focused`) to support dual simulator/TV input, but the primary focus of development is the active focused class.

### Default Button Styling
* **Single Source of Truth**: The app uses the `.capsule-btn` CSS class as the standard, universal styling for prominent buttons (e.g., "Go Back", HUD controls).
* **Colors & Focus**: The default styling is **white fill with black text** and a white border. On focus, the button **inverts** to **black fill with white text** and scales up slightly. This high-contrast inversion provides an unmistakable and premium focus indicator.
* **Consistency**: Do not create custom ad-hoc buttons. Always leverage `.capsule-btn` to maintain a single source of truth and consistent design language across the entire application.

---

## 2. GPU & CPU Performance Guidelines

Smart TV System-on-Chips (SoCs) are severely CPU and GPU resource-constrained. Unoptimized CSS will drop application framerates below 12 FPS. Follow these strict performance rules:

### 🚫 Prohibited CSS Properties
* **No Backdrop Filters**: Never use `backdrop-filter: blur(...)` or `-webkit-backdrop-filter`. The TV browser engine has to copy the screen buffer, apply a GPU blur, and composite it on every frame, which destroys performance. Use solid, high-opacity dark background colors instead (e.g., `rgba(25, 25, 30, 0.95)`).
* **No Dynamic Box Shadows**: Avoid transitioning `box-shadow` on focus states. Drawing dynamic blurred shadows requires heavy paint loops. If a shadow is required for depth, keep it static or use a single, low-radius shadow (e.g., `box-shadow: 0 0 10px #e5a00d`).

### ⚡ GPU Acceleration & Layer Promotion
* **will-change**: Always add `will-change: transform` on elements that scale, translate, or move. This tells the browser to create a dedicated composite layer on the GPU.
* **3D Transforms**: Use `transform: translate3d(0, 0, 0)` or translate/scale combined with 3D layers to force the GPU to handle the rendering of the element, keeping animations off the busy single-threaded CPU.
  ```css
  /* Example of a high-performance card focus style */
  .card {
    will-change: transform;
    transform: translate3d(0, 0, 0);
    transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.12s ease;
  }
  .card.focused {
    transform: scale(1.08) translate3d(0, 0, 0) !important;
  }
  ```

### ⏱️ Transition & Animation Rules
* **Snappy Durations**: Keep focus transition durations between **`0.1s` and `0.12s`** (100ms - 120ms), or make them **instant (`0s`)**. Long animations feel mushy and introduce input lag when users tap remote keys rapidly.
* **Restricted Transition Properties**: Never transition `all` properties. Explicitly list the properties to transition (ideally only `transform` and `opacity`).
  * **Good**: `transition: transform 0.12s ease, opacity 0.12s ease;`
  * **Bad**: `transition: all 0.25s ease;` (forces layout recalculations for every style property).
* **Layout Property Snapping (The Navigation Bar Rule)**:
  * For elements that undergo layout resizing on toggle (such as the Sidebar/NavigationBar expanding/collapsing), **never transition layout-affecting properties** like `width`, `max-width`, `height`, `max-height`, `margin`, `padding`, or `border-radius`.
  * Let these layout properties update **instantly** (`0s` duration) so the browser engine performs exactly one layout pass, and transition only hardware-accelerated properties (`opacity` or `transform`) for the entry/exit fade effects. This prevents low-end TV CPUs from thrashing during resizing.



## 3. Architecture & Session Tracking

### LGUDID Persistence
To maintain reliable Plex playback states across app restarts without creating ghost devices, the app fetches the hardware-level `LGUDID` via Luna DB8 (`luna://com.webos.service.sm`) at startup. This value persistently replaces any generated browser UUID and must be injected into every API request via the `X-Plex-Client-Identifier` header.

### PlayQueue Synchronization
Plex playback tracking requires strict synchronous flow control:
1. **Prerequisite**: Stream playback MUST be blocked until a `POST /playQueues` request succeeds.
2. **Queue ID Capture**: The response yields a `playQueueItemID`.
3. **Timeline Sync**: The `playQueueItemID` MUST be attached to every `/:/timeline` ping.
4. **App Exit**: On unmount, a final `state=stopped` ping is dispatched via `navigator.sendBeacon` to guarantee the Plex server logs the precise exit timestamp before the WebOS application context is fully destroyed.

---

## [Document: REACTIVE_ARCHITECTURE_GUIDELINES.md]

# Reactive Architecture & State Management Guidelines

This document details the reactive state management principles for the application. It serves as a strict rulebook for mitigating recurring synchronization errors when transitioning from imperative, component-level workflows into unified reactive pipelines (e.g., SWR, Zustand).

---

## 1. The Reactive Pipeline Principle

When migrating imperative workflows (e.g., profile switching, server discovery) into declarative, reactive flows (e.g., `useEffect` mount logic, SWR query hooks), the central philosophy is:
**State mutators must act atomically, and the view layer must reactively synchronize to that state.**

* **Imperative Anti-Pattern:** A controller halts the UI to dispatch a network request, waits for a token, probes the server, saves all variables, and then commands the app to reload.
* **Reactive Pattern:** A controller updates the current `profileId` state and unblocks. The React mount lifecycle observes the new `profileId`, detects that it needs a server connection, dispatches a background discovery task, and the UI selectively unblurs/renders as the SWR cache hydrates.

---

## 2. Multi-Axis State Validation (The "Silent Drop" Flaw)

We have encountered a recurring architectural bug 4-5 times during reactive refactors. The bug manifests as `401 Unauthorized` errors when fetching content, despite the network discovery logs showing successful healthy pings.

### The Problem
When the reactive layer dynamically discovers a server and attempts to synchronize it with the local store, developers often implement a simple URI cache-busting check:
```javascript
// ❌ ANTI-PATTERN: URI-only validation
if (resolvedServer?.uri && resolvedServer.uri !== currentUri) {
  saveToStore(resolvedServer);
}
```
If a Managed User logs in, the active connection URI might remain completely identical to the Admin's fast-path URI (e.g., `http://192.168.68.54`). Because `resolvedServer.uri === currentUri`, the `if` statement evaluates to `false`. **The app silently discards the newly generated, user-specific authorization token** because it assumed the identical URI meant no changes occurred. The app then attempts to query libraries using the global user token instead of the server-specific token, resulting in a catastrophic 401.

### The Required Fix
When adapting imperative connection flows into a reactive pipeline, you must guarantee that **State Validation happens across all critical axes (URI + Token)** symmetrically. 

```javascript
// ✅ CORRECT PATTERN: Multi-Axis Validation
if (resolvedServer?.uri && (resolvedServer.uri !== currentUri || resolvedServer.token !== currentToken)) {
  saveToStore(resolvedServer);
}
```

Never assume that because a connection URI is identical, the authorization context acting on it is identical. You must explicitly diff the token.

---

## 3. Strict Token Sourcing for Plex SWR Hooks

Plex operates on a strict multi-token hierarchy:
1. **Main Token:** The primary account token. Used to hit `plex.tv` resources to fetch the comprehensive list of owned servers.
2. **User Token (`authToken`):** The profile-specific token (e.g., a Managed User's PIN-verified token).
3. **Server Access Token (`server.accessToken`):** The specifically scoped token granted by `plex.tv` for a particular user to access a particular server instance.

### SWR Fetching Rules
* **Never use the generic `authToken` to fetch library content.** Library content (`/library/sections`, `/library/recentlyAdded`) must **always** use the explicit `server.accessToken` retrieved during the discovery loop.
* **Fallback Cascades:** When hydrating SWR queries (`loadAllSelectedLibraries`), ensure your token fallback chain resolves the dynamically discovered token first, before falling back to the global store:
  ```javascript
  const tokenToUse = overrideToken || serverInfo?.token || store.activeServer?.token || fallbackGlobalToken;
  ```

By strictly adhering to these reactive state validation rules, the app's server routing will remain fully decoupled, self-healing, and invulnerable to silent token drops.

---

## [Document: PROFILE_SWITCHING_WORKFLOW.md]

# Profile Switching Workflow & Architecture

This document maps out the specific flow and architectural requirements for switching Plex user profiles within the application. It acts as a companion to the `REACTIVE_ARCHITECTURE_GUIDELINES.md`.

---

## 1. The Core Philosophy

Profile switching in this application adheres to a **Reactive Pipeline Pattern**.

* **No Imperative Server Discovery:** The profile switcher does **not** attempt to probe network topographies, find servers, or test connection speeds. 
* **Atomic State Mutation:** The switcher's sole responsibility is verifying authorization and updating the singular "Active Profile" state in the global store.
* **Reactive Hand-off:** Once the active profile is set and the page reloads, the view layer (`ContentBrowserPage`) natively reacts to the new profile, realizes it lacks a verified server connection, and dynamically bootstraps the background discovery process.

---

## 2. The Step-by-Step Flow

### Step 1: User Selection & Verification
1. The user selects a profile from the User Switcher modal.
2. If the profile is protected (`protected: true`), the PIN dialog appears.
3. The app submits the PIN to Plex via `plexAuthService.verifyUserPin`.
4. Plex returns a **Managed User Token (`authToken`)**.

### Step 2: Atomic State Mutation
1. The profile switcher calls `useAppStore.getState().setProfileSession` with the new profile data and the new Managed User Token.
2. `setProfileSession` writes these values directly to IndexedDB (and `localStorage` for immediate cold-boot caching).
3. The switcher executes `window.location.reload()` to completely flush out any lingering component states, SWR caches, and DOM instances tied to the previous user.

### Step 3: Reactive Bootstrapping (The Page Reload)
1. The app boots. `ContentBrowserPage` mounts.
2. It reads the fastest known server URI from the database (`currentUri`), but recognizes it only has the global Managed User token (`currentToken = token`).
3. The "Fast Path" ping attempt predictably fails (`401 Unauthorized`), because the server requires a server-specific token, not a global token.
4. The page falls back to the background discovery process: `resolveAccessibleServer`.

### Step 4: Native Discovery & SWR Hydration
1. `resolveAccessibleServer` queries `plex.tv/api/v2/resources` using the new global Managed User token.
2. Plex.tv natively filters the server list down to only what that specific Managed User is authorized to see.
3. Plex.tv provides a distinct, specifically-scoped **Server Access Token (`server.accessToken`)** for that user.
4. The app maps this token, probes the server for the fastest URI, and hands the finalized `{ uri, token }` bundle back to `ContentBrowserPage`.
5. `ContentBrowserPage` verifies that the token changed, commits the new server token to the global `useServerStore`, and dynamically triggers the SWR queries to hydrate the libraries using the new token.

---

## 3. Critical Warnings for Developers

### Do NOT Block the Switcher
Do not attempt to add `resolveAccessibleServer` or `getBestServerConnection` calls back into the `handlePinSubmit` function. Doing so forces the user to stare at a frozen PIN dialog for up to 10 seconds while the app probes IP addresses. The atomic reload allows the UI to render its loading states while the discovery happens asynchronously.

### Do NOT Share SWR Caches Across Profiles
The SWR query keys must strictly include both the `serverUri` and the active `token` (or profile ID). If they do not, the app will instantly render the previous user's cached library arrays before the network requests catch up, resulting in data leakage between profiles.

### Multi-Axis SWR Fallbacks
When SWR queries (e.g., `loadAllSelectedLibraries`) attempt to fetch data during the exact moment the server is transitioning tokens, ensure the fallback cascade checks the dynamically resolved variables *first*, before falling back to the global store:
```javascript
const tokenToUse = overrideToken || serverInfo?.token || store.activeServer?.token || token
```

---

## [Document: src/services/plex/PLEX_SMART_TRANSCODING.md]

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


---

## [Document: plex-embedded-subtitles-guide.md]

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

---

