/**
 * Generic Luna service wrapper
 * Handles communication with webOS Luna services with localStorage fallback
 */

const isWebOS = () => !!window.webOS?.service

export const setConfig = async (key, value) => {
  if (!isWebOS()) {
    console.warn('webOS not available, using localStorage')
    localStorage.setItem(key, JSON.stringify(value))
    return { success: true }
  }

  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.service.configurator', {
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
  if (!isWebOS()) {
    console.warn('webOS not available, using localStorage')
    const value = localStorage.getItem(key)
    return value !== null ? JSON.parse(value) : defaultValue
  }

  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.service.configurator', {
      method: 'getConfigs',
      parameters: {
        configNames: [key]
      },
      onSuccess: (res) => resolve(res?.configs?.[key] ?? defaultValue),
      onFailure: (err) => {
        console.error('Luna getConfig failed:', err)
        resolve(defaultValue)
      }
    })
  })
}

export const deleteConfig = async (key) => {
  if (!isWebOS()) {
    localStorage.removeItem(key)
    return { success: true }
  }

  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.service.configurator', {
      method: 'setConfigs',
      parameters: {
        configs: { [key]: null }
      },
      onSuccess: resolve,
      onFailure: reject
    })
  })
}