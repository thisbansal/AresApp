import { universalStorage } from '../UniversalStorage/universalStorage';
import { PLEX_CONFIG } from '../../config/app';

const LATENCY_CACHE_KEY = 'plex_connection_latencies';
const DEFAULT_TIMEOUT = 5000; // 5 seconds default timeout for probes

// Default sorting weights for connection types when no latency cache exists
export const CONNECTION_PRIORITY = {
  LOCAL: 100,     // Local connections first
  REMOTE: 300,    // Remote connections second
  RELAY: 2000     // Relays last
};

const getHeaders = (authToken) => ({
  'Accept': 'application/json',
  'X-Plex-Product': PLEX_CONFIG.product,
  'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
  'X-Plex-Token': authToken,
  'X-Plex-Version': '1.0.0'
});

/**
 * Retrieve the latency cache map from UniversalStorage
 */
export const getLatencyCache = async () => {
  try {
    const raw = await universalStorage.get(LATENCY_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[Connection Ranker] Failed to load latency cache:', e);
    return {};
  }
};

/**
 * Save a URI's measured latency to cache
 */
export const saveLatency = async (uri, latency) => {
  try {
    const cache = await getLatencyCache();
    cache[uri] = {
      latency,
      timestamp: Date.now()
    };
    await universalStorage.set(LATENCY_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('[Connection Ranker] Failed to save latency to cache:', e);
  }
};

/**
 * Probe a single connection URI and return its latency in milliseconds
 */
export const probeLatency = async (uri, authToken, timeoutMs = DEFAULT_TIMEOUT) => {
  const start = Date.now();
  try {
    const urlObj = new URL(uri);
    urlObj.searchParams.append('X-Plex-Token', authToken);
    urlObj.searchParams.append('X-Plex-Client-Identifier', PLEX_CONFIG.clientId);
    urlObj.searchParams.append('X-Plex-Product', PLEX_CONFIG.product);
    urlObj.searchParams.append('X-Plex-Version', '1.0.0');
    const finalUri = urlObj.toString();

    const fetchPromise = fetch(finalUri, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }).then(res => res.ok ? (Date.now() - start) : null);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });

    const elapsed = await Promise.race([fetchPromise, timeoutPromise]);
    if (elapsed !== null && elapsed !== undefined) {
      await saveLatency(uri, elapsed);
      return elapsed;
    }
  } catch (err) {
    // Silently handle failed probes
  }
  return null;
};

/**
 * Sort a list of connection objects based on cached latencies and connection types.
 */
export const sortConnectionsByRank = async (connections) => {
  if (!connections || connections.length === 0) return [];

  const cache = await getLatencyCache();

  return [...connections].sort((a, b) => {
    const cacheA = cache[a.uri];
    const cacheB = cache[b.uri];

    // 1. If both have cached latency, sort by speed (fastest first)
    if (cacheA && cacheB) {
      return cacheA.latency - cacheB.latency;
    }

    // 2. If only one has cached latency, prioritize the one that worked recently
    if (cacheA) return -1;
    if (cacheB) return 1;

    // 3. Fallback to default weights (Local > Remote > Relay)
    const weightA = a.local ? CONNECTION_PRIORITY.LOCAL : (a.relay ? CONNECTION_PRIORITY.RELAY : CONNECTION_PRIORITY.REMOTE);
    const weightB = b.local ? CONNECTION_PRIORITY.LOCAL : (b.relay ? CONNECTION_PRIORITY.RELAY : CONNECTION_PRIORITY.REMOTE);

    return weightA - weightB;
  });
};
