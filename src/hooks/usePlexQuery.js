import { useState, useEffect, useRef, useCallback } from 'react';
import { getData, setData, DB_KINDS } from '../services/luna/lunaService';
import { useServerStore } from '../stores/serverStore';
import { useAppStore } from '../stores/AppStore';

/**
 * Custom hook implementing the Stale-While-Revalidate (SWR) pattern.
 * Resolves cached content instantly from Luna DB, fires background fetch,
 * and updates reactively. Recovers from connection failures gracefully.
 *
 * @param {string|Array} queryKey - Unique identifier for caching
 * @param {Function} fetchFn - Promise-based data fetch function
 * @param {Object} [options] - Options configuration
 * @param {boolean} [options.enabled=true] - Set to false to disable queries
 * @param {any} [options.initialData] - Initial fallback data
 */
export function usePlexQuery(queryKey, fetchFn, options = {}) {
  const { enabled = true, initialData = null } = options;

  const isOnline = useServerStore(state => state.isOnline);
  const profileId = useAppStore(state => state.userProfile?.userId || 'default');

  const [data, setLocalData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData && enabled);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState(null);

  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  // Track the last key loaded to avoid loop-triggering resets when initialData object reference changes
  const lastKeyRef = useRef('');

  // Generate a deterministic safe cache key string
  const keyStr = Array.isArray(queryKey) 
    ? queryKey.map(k => typeof k === 'object' ? JSON.stringify(k) : k).join('_') 
    : String(queryKey);
  const safeKey = keyStr.replace(/[^a-zA-Z0-9]/g, '_');
  const cacheKey = `swr_cache_${safeKey}_${profileId}`;

  const revalidate = useCallback(async (forceLoading = false) => {
    if (!enabled) return;

    if (forceLoading) {
      setLoading(true);
    }
    setIsRevalidating(true);
    setError(null);

    try {
      // Execute the fetch function
      const freshData = await fetchFnRef.current();
      
      // Prevent race conditions: check if key is still the active one
      if (lastKeyRef.current !== cacheKey) {
        return;
      }
      
      // Save to cache
      await setData(DB_KINDS.PREFERENCES, cacheKey, JSON.stringify(freshData));
      
      setLocalData(freshData);
      setError(null);
    } catch (err) {
      if (lastKeyRef.current !== cacheKey) {
        return;
      }
      console.warn(`[usePlexQuery] Revalidation failed for key ${cacheKey}:`, err.message);
      setError(err);
      
      // If we got a network error, update global isOnline status
      const isNetworkError = err.name === 'AbortError' || err instanceof TypeError || err.message.includes('fetch');
      if (isNetworkError) {
        useServerStore.getState().setServerState(false, err.message);
      }
    } finally {
      if (lastKeyRef.current === cacheKey) {
        setLoading(false);
        setIsRevalidating(false);
      }
    }
  }, [enabled, cacheKey]);

  // 1. Initial Cache Load & Key Changes
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;

    // Reset local state only if the key has actually changed!
    if (lastKeyRef.current !== cacheKey) {
      lastKeyRef.current = cacheKey;
      setLocalData(initialData);
      setLoading(!initialData);
    }

    const loadInitialCache = async () => {
      try {
        const cachedRaw = await getData(DB_KINDS.PREFERENCES, cacheKey, null);
        if (active && cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          setLocalData(cached);
          setLoading(false);
        }
      } catch (err) {
        console.warn(`[usePlexQuery] Failed to load cache for ${cacheKey}:`, err);
      } finally {
        // Run network revalidation in background
        if (active) {
          revalidate();
        }
      }
    };

    loadInitialCache();

    return () => {
      active = false;
    };
  }, [enabled, cacheKey, revalidate]);

  // 2. Reactive Auto-Refetch when connection is restored (from offline back to online)
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (enabled && isOnline && !wasOnlineRef.current) {
      console.log('[usePlexQuery] Reconnection detected. Auto-revalidating...', queryKey);
      revalidate();
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, enabled, revalidate]);

  return {
    data,
    loading,
    error,
    isRevalidating,
    mutate: setLocalData,
    revalidate
  };
}
