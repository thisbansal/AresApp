import { getActiveServerInfo } from './plexConnectionService'
import { useServerStore } from '../../stores/serverStore'
import { useAppStore } from '../../stores/AppStore'
import { useServerManagerStore } from '../../stores/serverManagerStore'
import { PLEX_CONFIG } from '../../config/app'
import { getPlatformInfo } from '../../utils/platformInfo'

let isRecovering = false;

export const attemptConnectionRecovery = async () => {
  if (isRecovering) return false;
  isRecovering = true;

  const serverStore = useServerStore.getState();
  serverStore.log('INFO', 'Initiating event-driven connection recovery...');

  try {
    const activeServer = serverStore.activeServer;
    if (!activeServer) {
      isRecovering = false;
      return false;
    }

    const appStore = useAppStore.getState();
    const token = appStore.token || activeServer.token;

    // Retrieve full server data from serverManagerStore
    const smStore = useServerManagerStore.getState();
    
    // Find the server in serverManagerStore matching our active server token/URI/clientIdentifier
    const serverEntry = Object.values(smStore.servers).find(
      s => s.accessToken === activeServer.token || s.uri === activeServer.uri
    );

    if (!serverEntry) {
      serverStore.log('WARN', 'Could not locate matching server entry in cache for recovery.');
      isRecovering = false;
      return false;
    }

    serverStore.log('INFO', `Probing alternative connections for server "${serverEntry.name}"...`);
    const { getBestServerConnection } = await import('./plexAPIServer');
    const newUri = await getBestServerConnection(serverEntry, token);

    if (newUri && newUri !== activeServer.uri) {
      serverStore.log('INFO', `Successfully recovered! Switched connection URI from "${activeServer.uri}" to "${newUri}"`);
      
      const updatedActiveServer = {
        ...activeServer,
        uri: newUri
      };

      // 1. Update active server state
      useServerStore.setState({ activeServer: updatedActiveServer, isOnline: true });

      // 2. Update server entry in manager store and cache
      serverEntry.uri = newUri;
      const updatedServers = {
        ...smStore.servers,
        [serverEntry.clientIdentifier]: serverEntry
      };
      useServerManagerStore.setState({ servers: updatedServers });
      await smStore.saveServersToCache(updatedServers);

      isRecovering = false;
      return true;
    } else {
      serverStore.log('WARN', 'Recovery probe finished but no faster or alternative connections succeeded.');
    }
  } catch (err) {
    serverStore.log('ERROR', 'Error during connection recovery:', err.message);
  }

  isRecovering = false;
  return false;
};

export const plexBridge = {
  /**
   * Helper to verify if the active server is online/reachable.
   */
  async ping() {
    const store = useServerStore.getState()
    try {
      const activeServer = await getActiveServerInfo()
      store.log('INFO', 'Pinging Plex Media Server...', activeServer.uri)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(`${activeServer.uri}/`, {
        method: 'GET',
        headers: {
          'X-Plex-Token': activeServer.token,
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        store.setServerState(true)
        store.log('INFO', 'Server is healthy.')
        return true
      } else {
        if (response.status === 401) {
          useAppStore.getState().handleServerAuthError()
        }
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Ping timeout' : err.message
      store.setServerState(false, errorMsg)
      store.log('FATAL', `Plex Media Server went offline: ${errorMsg}`)
      
      // Trigger lazy connection recovery in the background
      attemptConnectionRecovery().then(recovered => {
        if (recovered) {
          plexBridge.ping();
        }
      });

      return false;
    }
  },

  /**
   * Centralized requests bridge with integrated health checking and severity logging.
   */
  async request(endpoint, options = {}, serverInfo = null) {
    const store = useServerStore.getState()
    let activeServer = serverInfo || store.activeServer

    try {
      if (!activeServer) {
        activeServer = await getActiveServerInfo(serverInfo)
        useServerStore.setState({ activeServer })
      } else if (
        !serverInfo && (
          activeServer.uri !== store.activeServer?.uri ||
          activeServer.token !== store.activeServer?.token
        )
      ) {
        useServerStore.setState({ activeServer })
      }
    } catch (err) {
      store.log('FATAL', 'Could not resolve server credentials.', err.message)
      throw err
    }

    const separator = endpoint.includes('?') ? '&' : '?'
    const url = `${activeServer.uri}${endpoint}${separator}X-Plex-Token=${activeServer.token}`
    
    const platformInfo = await getPlatformInfo()
    
    // Auto default headers
    const headers = {
      'Accept': 'application/json',
      'X-Plex-Client-Identifier': PLEX_CONFIG.clientId,
      'X-Plex-Product': PLEX_CONFIG.product,
      'X-Plex-Version': '1.0.0',
      'X-Plex-Platform': platformInfo.platform,
      'X-Plex-Platform-Version': platformInfo.version,
      'X-Plex-Device': platformInfo.device,
      'X-Plex-Device-Name': platformInfo.device,
      ...options.headers
    }

    store.log('INFO', `Sending request: ${options.method || 'GET'} ${endpoint}`)

    const controller = new AbortController()
    const timeoutMs = options.timeout || 30000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: options.signal || controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status === 401) {
            useAppStore.getState().handleServerAuthError()
          }
          if (!options.silent) {
            store.log('ERROR', `Server returned status ${response.status} on ${endpoint}`)
          }
          throw new Error(`HTTP ${response.status}`)
        }

        // If we got a successful response for the main server, ensure server status is set back to online
        const currentState = useServerStore.getState()
        const isMainServer = currentState.activeServer?.uri && url.startsWith(currentState.activeServer.uri)
        if (isMainServer && !currentState.isOnline) {
          currentState.setServerState(true)
          if (!options.silent) {
            currentState.log('INFO', 'Server connection recovered.')
          }
        }

        return response
      } catch (err) {
        lastErr = err;
        // Only retry on network errors (TypeError), not HTTP errors or AbortErrors
        if (err instanceof TypeError && attempt < 3) {
          store.log('WARN', `Request failed (attempt ${attempt}/3). Retrying in 500ms...`)
          await new Promise(res => setTimeout(res, 500))
          continue;
        }
        break; // Break on AbortError, HTTP errors, or if out of retries
      }
    }

    clearTimeout(timeoutId)
    const err = lastErr;
    const isNetworkError = err.name === 'AbortError' || err instanceof TypeError
    
    const currentState = useServerStore.getState()
    const isMainServer = currentState.activeServer?.uri && url.startsWith(currentState.activeServer.uri)

    if (isNetworkError) {
      const errorMsg = err.name === 'AbortError' ? 'Request timeout' : err.message
      
      if (isMainServer) {
        currentState.setServerState(false, errorMsg)
        if (!options.silent) {
          currentState.log('FATAL', `Network failure on request to ${endpoint}: ${errorMsg}`)
        }

        // Trigger lazy connection recovery in the background
        attemptConnectionRecovery().then(recovered => {
          if (recovered) {
            currentState.log('INFO', 'Connection recovery swapped server URI.')
          }
        });
      } else {
        if (!options.silent) {
          currentState.log('WARN', `Network failure on secondary server request to ${endpoint}: ${errorMsg}`)
        }
      }
      
    } else {
      if (!options.silent) {
        store.log('ERROR', `Request error on ${endpoint}: ${err.message}`)
      }
    }
    
    throw err
  }
}
