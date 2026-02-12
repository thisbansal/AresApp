/**
 * Generic Luna service wrapper
 * Handles communication with webOS Luna services with localStorage fallback
 * Uses DB8 database service for persistent storage on LG webOS devices
 */
import { isWebOS } from "../Environment/environment"
import { PLEX_CONFIG } from "../../config/app"

const DB8_URL = 'luna://com.palm.db'
// const DB_NAME = 'appstore'

// Database kinds for different data categories
export const DB_KINDS = {
  CONFIG: `${PLEX_CONFIG.appID}.config:1`,
  USER: `${PLEX_CONFIG.appID}.user:1`,
  PREFERENCES: `${PLEX_CONFIG.appID}.preferences:1`,
  HISTORY: `${PLEX_CONFIG.appID}.history:1`,
  SERVER: `${PLEX_CONFIG.appID}.servers:1`
  // Add more kinds as needed
}

// Initialize all database kinds - call this ONCE at app startup
export const initialiseDatabase = async () => {
  return Promise.all([
    initDB8Kind(DB_KINDS.CONFIG),
    initDB8Kind(DB_KINDS.USER),
    initDB8Kind(DB_KINDS.PREFERENCES),
    initDB8Kind(DB_KINDS.HISTORY),
  ])
}

// Track which kinds have been initialized to avoid redundant calls
const initializedKinds = new Set()

// Initialize DB8 kind if needed
export const initDB8Kind = async (kindId) => {
  // Return immediately if already initialized
  if (initializedKinds.has(kindId)) {
    return true
  }

  if (!kindId) {
    console.warn('No kindId provided')
    return
  }

  return new Promise((resolve) => {
    window?.webos?.service.request(DB8_URL, {
      method: 'putKind',
      parameters: {
        id: kindId,
        owner: PLEX_CONFIG.appID,
        indexes: [{ name: 'key', props: [{ name: 'key' }] }]
      },
      onSuccess: () => {
        initializedKinds.add(kindId)
        resolve(true)
      },
      onFailure: (err) => {
        console.error('Failed to register kind:', kindId, err)
        initializedKinds.add(kindId) // Mark as attempted
        resolve(true)
      }
    })
  })
}

export const setData = async (kind, key, value) => {
  const available = isWebOS()

  if (!available) {
    console.warn('webOS not available, using localStorage')
    localStorage.setItem(`${kind}:${key}`, JSON.stringify(value))
    return { success: true }
  }
  // console.log("Attempting to save for: ", key)
  // console.log("With Value: ", value)
  return new Promise((resolve, reject) => {
    window?.webos?.service.request(DB8_URL, {
      method: 'put',
      parameters: {
        objects: [
          {
            _kind: kind,
            key: key,
            value: value
          }
        ]
      },
      onSuccess: (result) => {
        console.warn("stored data: ", result)
        resolve({ success: true, result })
      },
      onFailure: (err) => {
        console.error('Failed to set data:', err)
        reject(err)
      }
    })
  })
}

export const getData = async (kind, key, defaultValue = null) => {
  const available = isWebOS()

  if (!available) {
    console.warn('webOS not available, using localStorage')
    const value = localStorage.getItem(`${kind}:${key}`)
    return value !== null ? JSON.parse(value) : defaultValue
  }
  return new Promise((resolve, reject) => {
    window?.webos?.service.request(DB8_URL, {
      method: 'find',
      parameters: {
        query: {
          from: kind,
          where: [{ prop: 'key', op: '=', val: key }]
        }
      },
      onSuccess: (res) => {
        if (res?.results?.length > 0) {
          resolve(res.results[0].value ?? defaultValue)
        } else {
          resolve(defaultValue)
        }
      },
      onFailure: (err) => {
        console.warn('Failed to get data:', err)
        resolve(defaultValue)
      }
    })
  })
}

export const deleteData = async (kind, key) => {
  const available = isWebOS()

  if (!available) {
    localStorage.removeItem(`${kind}:${key}`)
    return { success: true }
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request(DB8_URL, {
      method: 'del',
      parameters: {
        query: {
          from: kind,
        },
      },
      onSuccess: function (inResponse) {
        console.log('The ' + inResponse.count + 'object(s) is(are) deleted');
        resolve({success: true})
      },
      onFailure: function (inError) {
        console.log('Failed to delete the object');
        console.log('[' + inError.errorCode + ']: ' + inError.errorText);
        reject(err)
        return;
      },
    })
  })
}