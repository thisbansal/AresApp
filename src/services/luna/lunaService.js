/**
 * Robust Luna service wrapper
 * Promise-based DB8 access with localStorage fallback
 */

import { isWebOS } from "../Environment/environment"
import { PLEX_CONFIG } from "../../config/app"
import LS2Request from "@enact/webos/LS2Request"

const DB8_URL = "luna://com.palm.db"

/**
 * Initializes and retrieves the unique device identifier (LGUDID) from the WebOS system.
 * This is crucial for Plex server synchronization to accurately track watch sessions
 * and device states across app restarts, without creating duplicate device entries.
 * 
 * Falls back to a randomly generated browser ID if not running on WebOS.
 * 
 * @returns {Promise<string>} The unique client ID (LGUDID).
 */
export const initDeviceId = async () => {
  if (!isWebOS()) {
    let id = localStorage.getItem('browser_device_id')
    if (!id) {
      id = 'browser-' + Math.random().toString(36).substring(2, 15)
      localStorage.setItem('browser_device_id', id)
    }
    PLEX_CONFIG.clientId = id
    return id
  }
  try {
    const res = await lunaCall({
      service: 'luna://com.webos.service.sm',
      method: 'deviceid/getIDs',
      parameters: { idType: ['LGUDID'] }
    })
    if (res && res.idList && res.idList.length > 0) {
      PLEX_CONFIG.clientId = res.idList[0].idValue
      return PLEX_CONFIG.clientId
    }
  } catch (e) {
    console.error('[LUNA DB8] Failed to get device UUID', e)
  }
  return PLEX_CONFIG.clientId
}

// Lazily create LS2Request instance
const createRequest = () => new LS2Request()

// Database kinds
export const DB_KINDS = {
  CONFIG: `${PLEX_CONFIG.appID}.config:1`,
  USER: `${PLEX_CONFIG.appID}.user:1`,
  PREFERENCES: `${PLEX_CONFIG.appID}.preferences:1`,
  HISTORY: `${PLEX_CONFIG.appID}.history:1`,
  SERVER: `${PLEX_CONFIG.appID}.servers:1`
}

const initializedKinds = new Set()

/**
 * Generic promise wrapper for LS2Request
 */
const lunaCall = ({ service, method, parameters }) => {
  console.log(`[LUNA DB8] CALL -> Service: ${service} | Method: ${method} | Parameters:`, JSON.stringify(parameters))
  return new Promise((resolve, reject) => {
    const request = createRequest()

    request.send({
      service,
      method,
      parameters,
      onSuccess: (res) => {
        console.log(`[LUNA DB8] SUCCESS -> Method: ${method} | Response:`, JSON.stringify(res))
        resolve(res)
      },
      onFailure: (err) => {
        console.error(`[LUNA DB8] FAILURE -> Method: ${method} | Error:`, JSON.stringify(err))
        reject(err)
      }
    })
  })
}

/**
 * Helper to check if an error is a missing index error
 */
const isIndexError = (err) => {
  return err && (err.errorCode === -3965 || (err.errorText && err.errorText.includes('index')));
}

/**
 * Auto-heal a kind by deleting and recreating it with the correct index
 */
const healKind = async (kindId) => {
  console.warn(`[LUNA DB8] Index missing for kind "${kindId}". Re-creating schema...`)
  try {
    await lunaCall({
      service: DB8_URL,
      method: "delKind",
      parameters: { id: kindId }
    })
  } catch (delErr) {
    console.warn(`[LUNA DB8] delKind failed (this is normal if kind did not exist yet):`, delErr)
  }

  try {
    await lunaCall({
      service: DB8_URL,
      method: "putKind",
      parameters: {
        id: kindId,
        owner: PLEX_CONFIG.appID,
        indexes: [{ name: "key", props: [{ name: "key" }] }]
      }
    })
    initializedKinds.add(kindId)
    console.log(`[LUNA DB8] Successfully healed and re-registered kind: ${kindId}`)
    return true
  } catch (putErr) {
    console.error(`[LUNA DB8] Failed to putKind after delete:`, putErr)
    return false
  }
}

/**
 * Initialise all DB kinds once
 */
export const initialiseDatabase = async () => {
  await Promise.all(Object.values(DB_KINDS).map(initDB8Kind))
  return true
}

/**
 * Register DB8 kind if not already registered
 */
export const initDB8Kind = async (kindId) => {
  if (!isWebOS()) return true
  if (!kindId) throw new Error("No kindId provided")

  if (initializedKinds.has(kindId)) return true

  try {
    await lunaCall({
      service: DB8_URL,
      method: "putKind",
      parameters: {
        id: kindId,
        owner: PLEX_CONFIG.appID,
        indexes: [{ name: "key", props: [{ name: "key" }] }]
      }
    })

    initializedKinds.add(kindId)
    return true
  } catch (err) {
    console.error("Failed to register kind:", kindId, err)
    initializedKinds.add(kindId)
    return false
  }
}

/**
 * Store data
 */
export const setData = async (kind, key, value, isRetry = false) => {
  if (!isWebOS()) {
    localStorage.setItem(`${kind}:${key}`, JSON.stringify(value))
    return { success: true }
  }

  try {
    // 1. Find existing record to get its _id
    const findRes = await lunaCall({
      service: DB8_URL,
      method: "find",
      parameters: {
        query: {
          from: kind,
          where: [{ prop: "key", op: "=", val: key }]
        }
      }
    })

    // 2. If it exists, delete it by _id (which is guaranteed to succeed and never requires queries/indexes)
    if (findRes && findRes.results && findRes.results.length > 0) {
      const idsToDelete = findRes.results.map(r => r._id)
      console.log(`[LUNA DB8] Found existing record(s) to upsert. Deleting by _id:`, idsToDelete)
      await lunaCall({
        service: DB8_URL,
        method: "del",
        parameters: { ids: idsToDelete }
      })
    }

    const result = await lunaCall({
      service: DB8_URL,
      method: "put",
      parameters: {
        objects: [{ _kind: kind, key, value }]
      }
    })

    return { success: true, result }
  } catch (err) {
    if (!isRetry && isIndexError(err)) {
      await healKind(kind)
      return await setData(kind, key, value, true)
    }
    console.error("Failed to set data:", err)
    return { success: false, error: err }
  }
}

/**
 * Retrieve data
 */
export const getData = async (kind, key, defaultValue = null, isRetry = false) => {
  if (!isWebOS()) {
    const value = localStorage.getItem(`${kind}:${key}`)
    return value !== null ? JSON.parse(value) : defaultValue
  }

  try {
    const res = await lunaCall({
      service: DB8_URL,
      method: "find",
      parameters: {
        query: {
          from: kind,
          where: [{ prop: "key", op: "=", val: key }]
        }
      }
    })

    if (res?.results?.length > 0) {
      console.log("getData returning value: ", res)
      return res.results[0].value
    }
    console.log("getData returning defaultValue: ", defaultValue)
    return defaultValue
  } catch (err) {
    if (!isRetry && isIndexError(err)) {
      await healKind(kind)
      return await getData(kind, key, defaultValue, true)
    }
    console.warn("Failed to get data:", err)
    return defaultValue
  }
}

/**
 * Delete data by key
 */
export const deleteData = async (kind, key, isRetry = false) => {
  if (!isWebOS()) {
    localStorage.removeItem(`${kind}:${key}`)
    return { success: true }
  }

  try {
    // 1. Find existing record to get its _id
    const findRes = await lunaCall({
      service: DB8_URL,
      method: "find",
      parameters: {
        query: {
          from: kind,
          where: [{ prop: "key", op: "=", val: key }]
        }
      }
    })

    // 2. If it exists, delete by _id (which is guaranteed to succeed and never requires queries/indexes)
    if (findRes && findRes.results && findRes.results.length > 0) {
      const idsToDelete = findRes.results.map(r => r._id)
      console.log(`[LUNA DB8] Deleting data by _id:`, idsToDelete)
      const res = await lunaCall({
        service: DB8_URL,
        method: "del",
        parameters: { ids: idsToDelete }
      })
      return { success: true, deleted: res.results?.length || idsToDelete.length }
    }

    return { success: true, deleted: 0 }
  } catch (err) {
    if (!isRetry && isIndexError(err)) {
      await healKind(kind)
      return await deleteData(kind, key, true)
    }
    console.error("Failed to delete data:", err)
    return { success: false, error: err }
  }
}