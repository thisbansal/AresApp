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


## 3. Architecture & Session Tracking

### LGUDID Persistence
To maintain reliable Plex playback states across app restarts without creating ghost devices, the app fetches the hardware-level `LGUDID` via Luna DB8 (`luna://com.webos.service.sm`) at startup. This value persistently replaces any generated browser UUID and must be injected into every API request via the `X-Plex-Client-Identifier` header.

### PlayQueue Synchronization
Plex playback tracking requires strict synchronous flow control:
1. **Prerequisite**: Stream playback MUST be blocked until a `POST /playQueues` request succeeds.
2. **Queue ID Capture**: The response yields a `playQueueItemID`.
3. **Timeline Sync**: The `playQueueItemID` MUST be attached to every `/:/timeline` ping.
4. **App Exit**: On unmount, a final `state=stopped` ping is dispatched via `navigator.sendBeacon` to guarantee the Plex server logs the precise exit timestamp before the WebOS application context is fully destroyed.
