/**
 * Robust Luna service wrapper
 * Promise-based DB8 access with localStorage fallback
 */

import { isWebOS } from "../Environment/environment"
import { PLEX_CONFIG } from "../../config/app"
import LS2Request from "@enact/webos/LS2Request"

const DB8_URL = "luna://com.palm.db"

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
const lunaCall = ({ service, method, parameters }) =>
  new Promise((resolve, reject) => {
    const request = createRequest()

    request.send({
      service,
      method,
      parameters,
      onSuccess: (res) => resolve(res),
      onFailure: (err) => reject(err)
    })
  })

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
export const setData = async (kind, key, value) => {
  if (!isWebOS()) {
    localStorage.setItem(`${kind}:${key}`, JSON.stringify(value))
    return { success: true }
  }

  try {
    const result = await lunaCall({
      service: DB8_URL,
      method: "put",
      parameters: {
        objects: [{ _kind: kind, key, value }]
      }
    })

    return { success: true, result }
  } catch (err) {
    console.error("Failed to set data:", err)
    return { success: false, error: err }
  }
}

/**
 * Retrieve data
 */
export const getData = async (kind, key, defaultValue = null) => {
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
    console.warn("Failed to get data:", err)
    return defaultValue
  }
}

/**
 * Delete data by key
 */
export const deleteData = async (kind, key) => {
  if (!isWebOS()) {
    localStorage.removeItem(`${kind}:${key}`)
    return { success: true }
  }

  try {
    const res = await lunaCall({
      service: DB8_URL,
      method: "del",
      parameters: {
        query: {
          from: kind,
          where: [{ prop: "key", op: "=", val: key }]
        }
      }
    })

    return { success: true, deleted: res.count }
  } catch (err) {
    console.error("Failed to delete data:", err)
    return { success: false, error: err }
  }
}