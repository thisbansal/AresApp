# Plex Embedded Subtitle Support — React WebOS Client
## Implementation Guide

---

## Overview

When a user selects an embedded subtitle in Plex, the server performs a **mixed playback session**:

- Video/Audio → Direct Play (raw MKV via `/library/parts/...`)
- Subtitle → Direct Stream (Plex extracts embedded SRT/ASS from MKV, serves as VTT)

Your client must negotiate this with PMS, fetch the subtitle stream separately, and render it as an HTML overlay on top of the AVPlay video element.

---

## Architecture

```
src/
├── services/
│   ├── plex/
│   │   ├── PlexClient.js              # Base HTTP client (auth, headers)
│   │   ├── PlaybackService.js         # Transcode decision, session management
│   │   ├── SubtitleService.js         # Subtitle negotiation + stream fetching
│   │   └── MediaService.js            # Library metadata fetching
│   └── subtitle/
│       ├── SubtitleRendererFactory.js # Factory: picks renderer by format
│       ├── VTTRenderer.js             # WebVTT parser + overlay renderer
│       └── SRTRenderer.js             # SRT parser (converts to VTT internally)
├── hooks/
│   ├── usePlaybackSession.js          # Manages playback lifecycle
│   ├── useSubtitles.js                # Subtitle state + track management
│   └── useVideoTime.js                # Current playback time (polling AVPlay)
├── components/
│   ├── Player/
│   │   ├── Player.jsx                 # Root player component
│   │   ├── VideoLayer.jsx             # AVPlay wrapper
│   │   ├── SubtitleOverlay.jsx        # Renders active subtitle cue
│   │   └── SubtitleTrackSelector.jsx  # UI to pick subtitle track
└── constants/
    └── plex.js                        # API paths, capability flags
```

---

## Step 1 — PlexClient (Base HTTP Layer)

All PMS requests go through a single authenticated client. This is the only place that knows about tokens and headers.

```js
// services/plex/PlexClient.js

const PLEX_HEADERS = {
  'X-Plex-Product': 'Plex for LG',
  'X-Plex-Platform': 'webOS',
  'X-Plex-Device': 'webOS 10.3.0',
  'X-Plex-Device-Name': 'LG WebOS TV',
  'X-Plex-Client-Identifier': '<your-client-uuid>',
  'Accept': 'application/json',
};

class PlexClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl; // e.g. http://192.168.68.54:32400
    this.token = token;
  }

  async get(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('X-Plex-Token', this.token);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { headers: PLEX_HEADERS });
    if (!res.ok) throw new Error(`PMS error: ${res.status} ${path}`);
    return res;
  }

  async getJSON(path, params = {}) {
    const res = await this.get(path, params);
    return res.json();
  }

  // Returns a fully qualified URL (for passing to AVPlay or fetch)
  buildUrl(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('X-Plex-Token', this.token);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }
}

export default PlexClient;
```

---

## Step 2 — MediaService (Fetch Subtitle Track Metadata)

Before negotiating playback, you need to know what subtitle streams exist in the media item and their stream IDs.

```js
// services/plex/MediaService.js

class MediaService {
  constructor(plexClient) {
    this.client = plexClient;
  }

  async getMediaInfo(ratingKey) {
    const data = await this.client.getJSON(`/library/metadata/${ratingKey}`, {
      checkFiles: 1,
      includeChapters: 1,
    });

    const item = data.MediaContainer.Metadata[0];
    const part = item.Media[0].Part[0];

    const subtitleStreams = (part.Stream || [])
      .filter(s => s.streamType === 3) // streamType 3 = subtitle
      .map(s => ({
        id: s.id,
        index: s.index,
        language: s.language,
        languageCode: s.languageCode,
        codec: s.codec,       // srt, ass, pgs, etc.
        title: s.displayTitle,
        external: s.key !== undefined, // has a key = external file
        forced: s.forced === 1,
        default: s.default === 1,
      }));

    return {
      ratingKey,
      mediaId: item.Media[0].id,
      partId: part.id,
      subtitleStreams,
    };
  }
}

export default MediaService;
```

---

## Step 3 — PlaybackService (Transcode Decision)

This mirrors what the official client does: call `/video/:/transcode/universal/decision` with `subtitles=sidecar` and the selected subtitle stream ID.

```js
// services/plex/PlaybackService.js

class PlaybackService {
  constructor(plexClient) {
    this.client = plexClient;
  }

  async getDecision({ ratingKey, sessionId, subtitleStreamId }) {
    const params = {
      directPlay: 1,
      directStream: 1,
      directStreamAudio: 1,
      protocol: 'hls',
      fastSeek: 1,
      path: `/library/metadata/${ratingKey}`,
      session: sessionId,
      mediaIndex: 0,
      partIndex: 0,
      mediaBufferSize: 50000,
      hasMDE: 1,
      subtitleSize: 100,
      videoQuality: 100,
      videoResolution: '1920x1080',
      audioBoost: 100,
      autoAdjustSubtitle: 1,
      subtitles: 'sidecar',      // key flag: request subtitle as separate sidecar
      location: 'lan',
      ...(subtitleStreamId && { subtitleStreamID: subtitleStreamId }),
    };

    const data = await this.client.getJSON(
      '/video/:/transcode/universal/decision',
      params
    );

    return this._parseDecision(data);
  }

  _parseDecision(data) {
    const session = data.MediaContainer;
    const part = session.Metadata?.[0]?.Media?.[0]?.Part?.[0];
    if (!part) throw new Error('Invalid decision response');

    const subtitleStream = part.Stream?.find(s => s.streamType === 3);

    return {
      decision: part.decision,           // 'directPlay', 'transcode', etc.
      videoUrl: this.client.buildUrl(part.key), // direct play URL
      subtitle: subtitleStream ? {
        id: subtitleStream.id,
        decision: subtitleStream.decision, // 'copy' = sidecar extraction
        location: subtitleStream.location, // 'sidecar'
        key: subtitleStream.key,           // the URL path to fetch the sub
      } : null,
    };
  }
}

export default PlaybackService;
```

---

## Step 4 — SubtitleService (Fetch & Parse the Subtitle Stream)

Once you have the subtitle `key` from the decision response, fetch it. Plex serves it as WebVTT.

```js
// services/plex/SubtitleService.js

class SubtitleService {
  constructor(plexClient) {
    this.client = plexClient;
  }

  // Fetch the subtitle file from the sidecar key returned in the decision
  async fetchSubtitleContent(subtitleKey) {
    const res = await this.client.get(subtitleKey);
    const text = await res.text();
    return text;
  }

  // Build the full subtitle URL (for passing to a renderer)
  getSubtitleUrl(subtitleKey) {
    return this.client.buildUrl(subtitleKey);
  }
}

export default SubtitleService;
```

---

## Step 5 — SubtitleRendererFactory

The factory decides which renderer to use based on the subtitle format, decoupling the rest of the app from format-specific logic.

```js
// services/subtitle/SubtitleRendererFactory.js
import VTTRenderer from './VTTRenderer';
import SRTRenderer from './SRTRenderer';

class SubtitleRendererFactory {
  static create(format) {
    switch (format?.toLowerCase()) {
      case 'vtt':
      case 'webvtt':
        return new VTTRenderer();
      case 'srt':
        return new SRTRenderer(); // internally converts to VTT cue format
      default:
        // Plex almost always serves VTT from the sidecar endpoint
        return new VTTRenderer();
    }
  }
}

export default SubtitleRendererFactory;
```

---

## Step 6 — VTTRenderer (Parse VTT into Cues)

```js
// services/subtitle/VTTRenderer.js

class VTTRenderer {
  parse(vttText) {
    const cues = [];
    // Split on double newline (cue blocks)
    const blocks = vttText.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      // Find the timing line
      const timingIndex = lines.findIndex(l => l.includes('-->'));
      if (timingIndex === -1) continue;

      const [startStr, endStr] = lines[timingIndex].split('-->').map(s => s.trim());
      const text = lines.slice(timingIndex + 1).join('\n').trim();

      if (!text) continue;

      cues.push({
        start: this._parseTimestamp(startStr),
        end: this._parseTimestamp(endStr),
        text,
      });
    }

    return cues;
  }

  // Returns seconds as float
  _parseTimestamp(ts) {
    // Format: HH:MM:SS.mmm or MM:SS.mmm
    const parts = ts.split(':');
    const seconds = parseFloat(parts.pop());
    const minutes = parseInt(parts.pop() || '0', 10);
    const hours = parseInt(parts.pop() || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
}

export default VTTRenderer;
```

---

## Step 7 — Hooks

### usePlaybackSession

Manages the full session lifecycle: decision, video URL, subtitle metadata.

```js
// hooks/usePlaybackSession.js
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

function usePlaybackSession({ plexClient, ratingKey, selectedSubtitleId }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const sessionId = useRef(uuidv4());

  useEffect(() => {
    if (!ratingKey) return;

    let cancelled = false;

    async function negotiate() {
      try {
        const playbackService = new PlaybackService(plexClient);
        const decision = await playbackService.getDecision({
          ratingKey,
          sessionId: sessionId.current,
          subtitleStreamId: selectedSubtitleId,
        });
        if (!cancelled) setSession(decision);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    }

    negotiate();
    return () => { cancelled = true; };
  }, [ratingKey, selectedSubtitleId]);

  return { session, error, sessionId: sessionId.current };
}

export default usePlaybackSession;
```

---

### useSubtitles

Fetches, parses, and tracks the active subtitle cue based on current playback time.

```js
// hooks/useSubtitles.js
import { useState, useEffect, useRef } from 'react';
import SubtitleRendererFactory from '../services/subtitle/SubtitleRendererFactory';

function useSubtitles({ subtitleService, subtitleKey, currentTime }) {
  const [cues, setCues] = useState([]);
  const [activeCue, setActiveCue] = useState(null);
  const rendererRef = useRef(null);

  // Fetch and parse subtitle when key changes
  useEffect(() => {
    if (!subtitleKey) {
      setCues([]);
      return;
    }

    let cancelled = false;

    async function load() {
      const content = await subtitleService.fetchSubtitleContent(subtitleKey);
      // Plex serves VTT from sidecar endpoint
      const renderer = SubtitleRendererFactory.create('vtt');
      rendererRef.current = renderer;
      const parsed = renderer.parse(content);
      if (!cancelled) setCues(parsed);
    }

    load();
    return () => { cancelled = true; };
  }, [subtitleKey]);

  // Find active cue based on current playback time
  useEffect(() => {
    if (!cues.length) return;
    const cue = cues.find(c => currentTime >= c.start && currentTime <= c.end);
    setActiveCue(cue || null);
  }, [currentTime, cues]);

  return { activeCue, cueCount: cues.length };
}

export default useSubtitles;
```

---

### useVideoTime

Polls AVPlay for the current playback position.

```js
// hooks/useVideoTime.js
import { useState, useEffect, useRef } from 'react';

function useVideoTime({ intervalMs = 250 } = {}) {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    function poll() {
      try {
        // AVPlay API on webOS
        const time = window.webapis?.avplay?.getCurrentTime?.() ?? 0;
        setCurrentTime(time / 1000); // AVPlay returns ms, convert to seconds
      } catch (_) {}
      rafRef.current = setTimeout(poll, intervalMs);
    }

    poll();
    return () => clearTimeout(rafRef.current);
  }, [intervalMs]);

  return currentTime;
}

export default useVideoTime;
```

---

## Step 8 — Components

### SubtitleOverlay

Pure presentational component. Receives the active cue text and renders it over the video.

```jsx
// components/Player/SubtitleOverlay.jsx

function SubtitleOverlay({ cue }) {
  if (!cue) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '8%',
      left: '10%',
      right: '10%',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      <span style={{
        display: 'inline-block',
        backgroundColor: 'rgba(0,0,0,0.75)',
        color: '#ffffff',
        fontSize: '2.2rem',
        lineHeight: 1.4,
        padding: '4px 12px',
        borderRadius: '4px',
        whiteSpace: 'pre-line',
      }}>
        {cue.text}
      </span>
    </div>
  );
}

export default SubtitleOverlay;
```

---

### Player (Root — Wires Everything Together)

```jsx
// components/Player/Player.jsx
import { useState } from 'react';
import usePlaybackSession from '../../hooks/usePlaybackSession';
import useSubtitles from '../../hooks/useSubtitles';
import useVideoTime from '../../hooks/useVideoTime';
import SubtitleOverlay from './SubtitleOverlay';
import SubtitleTrackSelector from './SubtitleTrackSelector';
import VideoLayer from './VideoLayer';

function Player({ plexClient, ratingKey, availableSubtitleTracks }) {
  const [selectedSubtitleId, setSelectedSubtitleId] = useState(null);

  const { session } = usePlaybackSession({
    plexClient,
    ratingKey,
    selectedSubtitleId,
  });

  const currentTime = useVideoTime();

  const subtitleService = new SubtitleService(plexClient);

  const { activeCue } = useSubtitles({
    subtitleService,
    subtitleKey: session?.subtitle?.key ?? null,
    currentTime,
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <VideoLayer videoUrl={session?.videoUrl} />
      <SubtitleOverlay cue={activeCue} />
      <SubtitleTrackSelector
        tracks={availableSubtitleTracks}
        selectedId={selectedSubtitleId}
        onSelect={setSelectedSubtitleId}
      />
    </div>
  );
}

export default Player;
```

---

## Step 9 — Seek Handling

Seeking introduces two problems that need to be addressed separately.

### Problem 1 — Cue lookup (non-issue)
`useSubtitles` already handles this correctly. It finds the cue matching `currentTime` on every time update, so after any seek it immediately shows the right cue. No extra work needed here.

### Problem 2 — Subtitle file format matters

Two scenarios depending on what Plex returns as `subtitle.key`:

**Scenario A — Single VTT file**
Plex serves the entire subtitle track as one file. All cues are loaded upfront, seeking is a complete non-issue. This is the most likely case for embedded SRT/ASS extraction.

**Scenario B — Segmented VTT (HLS-style)**
If `subtitle.key` is an `.m3u8` manifest pointing to `.vtt` segment files, seeking past a loaded segment means you need to fetch the new segment. This requires parsing the manifest and fetching segments on demand. Confirm which scenario you're in once you capture the logs.

### Problem 3 — AVPlay seek event latency

With 250ms polling, there's a window where `currentTime` lags behind the actual seek position. Fix this by listening to AVPlay's `onseekCompleted` event and forcing an immediate time refresh:

```js
// hooks/useVideoTime.js — updated with seek handling
import { useState, useEffect, useRef } from 'react';

function useVideoTime({ intervalMs = 250 } = {}) {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef(null);

  const readTime = () => {
    try {
      const time = window.webapis?.avplay?.getCurrentTime?.() ?? 0;
      setCurrentTime(time / 1000);
    } catch (_) {}
  };

  useEffect(() => {
    // Register AVPlay seek listener for immediate update on seek
    try {
      window.webapis?.avplay?.setListener?.({
        onseekCompleted: () => {
          readTime(); // force immediate refresh, don't wait for next poll
        },
      });
    } catch (_) {}

    // Regular polling for ongoing playback
    function poll() {
      readTime();
      rafRef.current = setTimeout(poll, intervalMs);
    }

    poll();
    return () => clearTimeout(rafRef.current);
  }, [intervalMs]);

  return currentTime;
}

export default useVideoTime;
```

### Problem 4 — Segmented subtitle seek (Scenario B only)

If subtitles are segmented, `useSubtitles` needs to track loaded segments and fetch on demand:

```js
// hooks/useSubtitles.js — extended for segmented VTT
import { useState, useEffect, useRef, useCallback } from 'react';
import SubtitleRendererFactory from '../services/subtitle/SubtitleRendererFactory';

function useSubtitles({ subtitleService, subtitleKey, currentTime }) {
  const [cues, setCues] = useState([]);
  const [activeCue, setActiveCue] = useState(null);
  const isSegmented = useRef(false);
  const loadedSegments = useRef(new Set());
  const segmentMap = useRef([]); // [{ startTime, url }]

  const loadSegmentForTime = useCallback(async (time) => {
    // Find which segment covers this time
    const segment = segmentMap.current.find(s => time >= s.startTime);
    if (!segment || loadedSegments.current.has(segment.url)) return;

    loadedSegments.current.add(segment.url);
    const content = await subtitleService.fetchSubtitleContent(segment.url);
    const renderer = SubtitleRendererFactory.create('vtt');
    const newCues = renderer.parse(content);
    setCues(prev => [...prev, ...newCues]);
  }, [subtitleService]);

  // Initial load — detect if single file or segmented manifest
  useEffect(() => {
    if (!subtitleKey) {
      setCues([]);
      isSegmented.current = false;
      loadedSegments.current.clear();
      segmentMap.current = [];
      return;
    }

    let cancelled = false;

    async function load() {
      const content = await subtitleService.fetchSubtitleContent(subtitleKey);

      if (content.includes('#EXTM3U')) {
        // Segmented — parse the m3u8 manifest
        isSegmented.current = true;
        segmentMap.current = parseM3U8(content, subtitleKey);
        // Load only the first segment initially
        if (!cancelled && segmentMap.current.length > 0) {
          await loadSegmentForTime(0);
        }
      } else {
        // Single VTT file — load all cues at once
        isSegmented.current = false;
        const renderer = SubtitleRendererFactory.create('vtt');
        const parsed = renderer.parse(content);
        if (!cancelled) setCues(parsed);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [subtitleKey]);

  // On seek or time update, ensure the right segment is loaded
  useEffect(() => {
    if (isSegmented.current) {
      loadSegmentForTime(currentTime);
    }
  }, [currentTime, loadSegmentForTime]);

  // Find active cue
  useEffect(() => {
    if (!cues.length) {
      setActiveCue(null);
      return;
    }
    const cue = cues.find(c => currentTime >= c.start && currentTime <= c.end);
    setActiveCue(cue || null);
  }, [currentTime, cues]);

  return { activeCue, cueCount: cues.length };
}

// Minimal m3u8 parser for subtitle segments
function parseM3U8(content, baseUrl) {
  const lines = content.split('\n');
  const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  const segments = [];
  let currentTime = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(':')[1]);
      const url = lines[i + 1]?.trim();
      if (url && !url.startsWith('#')) {
        segments.push({
          startTime: currentTime,
          duration,
          url: url.startsWith('http') ? url : `${base}${url}`,
        });
        currentTime += duration;
      }
    }
  }

  return segments;
}

export default useSubtitles;
```

---

## Data Flow Summary

```
User selects subtitle track
        ↓
Player sets selectedSubtitleId
        ↓
usePlaybackSession calls PlaybackService.getDecision()
  → GET /video/:/transcode/universal/decision
    ?subtitles=sidecar
    &subtitleStreamID=42861
        ↓
PMS responds: subtitle.decision=copy, subtitle.key=/path/to/sub.vtt
        ↓
useSubtitles fetches subtitle.key via SubtitleService
  → single VTT? load all cues at once
  → m3u8 manifest? parse segments, load first segment only
        ↓
SubtitleRendererFactory.create('vtt') → VTTRenderer.parse()
        ↓
useVideoTime polls AVPlay.getCurrentTime() every 250ms
  + AVPlay.onseekCompleted → immediate time refresh on seek
        ↓
[on seek] useSubtitles detects new currentTime
  → single VTT: cue lookup works immediately (all cues already loaded)
  → segmented: loadSegmentForTime() fetches missing segment if needed
        ↓
useSubtitles finds activeCue for currentTime
        ↓
SubtitleOverlay renders cue text as HTML overlay
```

---

## Key Things to Verify in Logs

Once you capture the subtitle selection moment in PMS logs, confirm:

1. **What `subtitleStreamID` parameter** the official client sends
2. **What the `subtitle.key` path looks like** in the decision response — this is the URL you fetch the VTT from
3. Whether Plex serves the sub as a **single VTT file** or **segmented** (if segmented you'll need to handle chunked fetching)

The log capture of subtitle selection is the one remaining unknown. Everything else above is solid based on what we've already seen.

4. **Single VTT or segmented m3u8** — this determines which seek path in `useSubtitles` gets exercised. If it's a single file, the segmented code path is dead code you can remove.
