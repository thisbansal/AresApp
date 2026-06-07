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
