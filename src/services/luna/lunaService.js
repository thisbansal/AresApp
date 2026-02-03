/**
 * Generic Luna service wrapper
 * Handles communication with webOS Luna services with localStorage fallback
 */
import { isWebOS } from "../Environment/environment"

let configuratorURL = 'luna://com.service.configurator'

export const setConfig = async (key, value) => {
  const available = isWebOS()

  if (!available) {
    console.warn('webOS not available, using localStorage')
    localStorage.setItem(key, JSON.stringify(value))
    return { success: true }
  }
  new Promise((resolve, reject) => {
    webos.service.request(configuratorURL, {
      method: 'setConfigs',
      parameters: {
        configs: { [key]: value }
      },
      onSuccess: () => resolve({ success: true }),
      onFailure: (err) => reject(err)
    })
  })
}

export const getConfig = async (key, defaultValue = null) => {
  const available = isWebOS()

  if (!available) {
    console.warn('webOS not available, using localStorage')
    const value = localStorage.getItem(key)
    return value !== null ? JSON.parse(value) : defaultValue
  }

  return new Promise((resolve, reject) => {
    webos?.service.request(configuratorURL, {
      method: 'getConfigs',
      parameters: {
        configNames: [key]
      },
      onSuccess: (res) => {
        resolve(res?.configs?.[key] ?? defaultValue)
      },
      onFailure: (err) => {
        console.warn('No config found:', err)
        resolve(defaultValue)
      }
    })
  })
}

export const deleteConfig = async (key) => {
  const available = isWebOS()

  if (!available) {
    localStorage.removeItem(key)
    return { success: true }
  }

  new Promise((resolve, reject) => {
    webos?.service.request(configuratorURL, {
      method: 'setConfigs',
      parameters: {
        configs: { [key]: null }
      },
      onSuccess: resolve,
      onFailure: reject
    })
  })
}