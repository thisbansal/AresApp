import { getData, setData, deleteData, DB_KINDS, initDB8Kind } from './lunaService'

const MAIN_TOKEN_KEY = 'plexMainToken'
const USER_TOKEN_KEY = 'plexUserToken'

// Call this once when your app starts
export const initialiseDatabase = async () => {
  await Promise.all([
    initDB8Kind(DB_KINDS.CONFIG),
    initDB8Kind(DB_KINDS.USER),
    initDB8Kind(DB_KINDS.PREFERENCES),
    initDB8Kind(DB_KINDS.HISTORY),
    initDB8Kind(DB_KINDS.SERVER)
  ])
}

// Main account token (for getting users, servers, etc.)
export const saveMainToken = async (token) => {
  return await setData(DB_KINDS.CONFIG, MAIN_TOKEN_KEY, token)
}

export const getMainToken = async () => {
  return await getData(DB_KINDS.CONFIG, MAIN_TOKEN_KEY)
}

// User-specific token (for accessing content as that user)
export const saveUserToken = async (token) => {
  return await setData(DB_KINDS.USER, USER_TOKEN_KEY, token)
}

export const getUserToken = async () => {
  return await getData(DB_KINDS.USER, USER_TOKEN_KEY)
}

export const getDB8Kind = async (kind, key) => {
  return await getData(kind, key)
}

export const saveToken = async (token) => {
  // Default to saving as main token
  return await saveMainToken(token)
}

export const clearTokens = async () => {
  await deleteData(DB_KINDS.CONFIG, MAIN_TOKEN_KEY)
  await deleteData(DB_KINDS.CONFIG, USER_TOKEN_KEY)
}