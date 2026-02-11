/**
 * Generic Luna service wrapper
 * Handles communication with webOS Luna services with localStorage fallback
 * Uses DB8 database service for persistent storage on LG webOS devices
 */
import { isWebOS } from "../Environment/environment"

const DB8_URL = 'luna://com.palm.db'
const APP_ID = 'com.nookbyte.aresapp'
// const DB_NAME = 'appstore'

// Database kinds for different data categories
export const DB_KINDS = {
  CONFIG: `${APP_ID}.config:1`,
  USER: `${APP_ID}.user:1`,
  PREFERENCES: `${APP_ID}.preferences:1`,
  HISTORY: `${APP_ID}.history:1`,
  SERVER: `${APP_ID}.servers:1`
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

  return new Promise((resolve) => {
    window?.webos?.service.request(DB8_URL, {
      method: 'putKind',
      parameters: {
        id: kindId,
        owner: APP_ID,
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
  console.log("Attempting to save for: ", key)
  console.log("With Value: ", value)
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
        console.log("stored data: ", result)
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
  console.log("Attempting to find object with key: ", key)
  console.log("If there's any defaultValue: ", defaultValue)
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
          console.log("Found the object in storage: ", res.results)
          resolve(res.results[0].value ?? defaultValue)
        } else {
          console.log("Couldn't find the object so defaultValue is: ", defaultValue)
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
    // First find the object to get its _id
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
          const id = res.results[0]._id
          // Then delete it
          window?.webos?.service.request(DB8_URL, {
            method: 'del',
            parameters: {
              ids: [id]
            },
            onSuccess: () => resolve({ success: true }),
            onFailure: (err) => {
              console.error('Failed to delete data:', err)
              reject(err)
            }
          })
        } else {
          resolve({ success: true })
        }
      },
      onFailure: (err) => {
        console.error('Failed to find data for deletion:', err)
        reject(err)
      }
    })
  })
}