import { getActiveServerInfo } from './plexConnectionService'
import { useServerStore } from '../../stores/serverStore'
import { useNotificationStore } from '../notifications/notificationStore'

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
      const timeoutId = setTimeout(() => controller.abort(), 3000)

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
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Ping timeout' : err.message
      store.setServerState(false, errorMsg)
      store.log('FATAL', `Plex Media Server went offline: ${errorMsg}`)
      
      useNotificationStore.getState().addNotification(
        `Server Offline: Check connection`, 
        { level: 'error' }
      )
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
        activeServer.uri !== store.activeServer?.uri ||
        activeServer.token !== store.activeServer?.token
      ) {
        useServerStore.setState({ activeServer })
      }
    } catch (err) {
      store.log('FATAL', 'Could not resolve server credentials.', err.message)
      throw err
    }

    const separator = endpoint.includes('?') ? '&' : '?'
    const url = `${activeServer.uri}${endpoint}${separator}X-Plex-Token=${activeServer.token}`
    
    // Auto default headers
    const headers = {
      'Accept': 'application/json',
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
        
        useNotificationStore.getState().addNotification(
          'Plex Server disconnected.', 
          { level: 'error' }
        )
      } else {
        store.log('ERROR', `Request error on ${endpoint}: ${err.message}`)
      }
      
      throw err
    }
  }
}
