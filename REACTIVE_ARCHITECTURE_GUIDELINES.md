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
