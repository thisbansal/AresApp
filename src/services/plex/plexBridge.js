import { getActiveServerInfo } from './plexConnectionService'
import { useServerStore } from '../../stores/serverStore'
import { useAppStore } from '../../stores/AppStore'
import { PLEX_CONFIG } from '../../config/app'
import { getPlatformInfo } from '../../utils/platformInfo'

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
      const timeoutId = setTimeout(() => controller.abort(), 10000)

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
      
      return false
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
    const timeoutMs = options.timeout || 10000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

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
        store.log('ERROR', `Server returned status ${response.status} on ${endpoint}`)
        throw new Error(`HTTP ${response.status}`)
      }

      // If we got a successful response, ensure server status is set back to online!
      if (!store.isOnline) {
        store.setServerState(true)
        store.log('INFO', 'Server connection recovered.')
      }

      return response
    } catch (err) {
      clearTimeout(timeoutId)
      const isNetworkError = err.name === 'AbortError' || err instanceof TypeError
      
      if (isNetworkError) {
        const errorMsg = err.name === 'AbortError' ? 'Request timeout' : err.message
        store.setServerState(false, errorMsg)
        store.log('FATAL', `Network failure on request to ${endpoint}: ${errorMsg}`)
        
      } else {
        store.log('ERROR', `Request error on ${endpoint}: ${err.message}`)
      }
      
      throw err
    }
  }
}
