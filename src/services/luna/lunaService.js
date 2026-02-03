/**
 * Generic Luna service wrapper
 * Handles communication with webOS Luna services with localStorage fallback
 */

let webOSReady = false

// Wait for webOS to be ready
if (typeof window !== 'undefined') {
  if (webos) {
    webOSReady = true
  } else {
    document.addEventListener('webOSReady', () => {
      webOSReady = true
      console.log('[Luna] webOS APIs now available')
    })
  }
}

const isWebOS = () => webOSReady || !!webos?.service

export const setConfig = async (key, value) => {
  const available = isWebOS()
  console.log(`setConfig called. isWebOS: ${available}`)

  if (!available) {
    console.warn('webOS not available, using localStorage')
    localStorage.setItem(key, JSON.stringify(value))
    return { success: true }
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.configurator', {
      method: 'setConfigs',
      parameters: {
        configs: { [key]: value }
      },
      onSuccess: resolve,
      onFailure: reject
    })
  })
}

export const getConfig = async (key, defaultValue = null) => {
  const available = isWebOS()
  console.log(`getConfig called. isWebOS: ${available}`)

  if (!available) {
    console.warn('webOS not available, using localStorage')
    const value = localStorage.getItem(key)
    return value !== null ? JSON.parse(value) : defaultValue
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.configurator', {
      method: 'getConfigs',
      parameters: {
        configNames: [key]
      },
      onSuccess: (res) => resolve(res?.configs?.[key] ?? defaultValue),
      onFailure: (err) => {
        console.warn('No config found:', err)
        resolve(defaultValue)
      }
    })
  })
}

export const deleteConfig = async (key) => {
  const available = isWebOS()
  console.log(`deleteConfig called. isWebOS: ${available}`)

  if (!available) {
    localStorage.removeItem(key)
    return { success: true }
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.configurator', {
      method: 'setConfigs',
      parameters: {
        configs: { [key]: null }
      },
      onSuccess: resolve,
      onFailure: reject
    })
  })
}