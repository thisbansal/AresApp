import { getData, setData, deleteData, DB_KINDS, initDB8Kind } from './lunaService'
import { KINDS } from '../../config/app'

const MAIN_TOKEN_KEY = 'plexMainToken'
const IS_VALID_USER = 'validPlexUser'
const USER_TOKEN_KEY = 'plexMainUser'

// Call this once when your app starts
export const initialiseDatabase = async () => {
  await Promise.all([
    initDB8Kind(DB_KINDS.CONFIG),
    initDB8Kind(DB_KINDS.USER),
    initDB8Kind(DB_KINDS.PREFERENCES),
    initDB8Kind(DB_KINDS.HISTORY),
    initDB8Kind(DB_KINDS.SERVER),
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
export const isValidUser = async (token) => {
  return await setData(DB_KINDS.IS_VALID_USER, IS_VALID_USER, token)
}

export const getUserToken = async () => {
  return await getData(DB_KINDS.USER, USER_TOKEN_KEY)
}

export const getDB8Kind = async (kind, key) => {
  return await getData(kind, key)
}

// User-specific profile settings
export const saveUserProfile = async (userProfile) => {
  return await setData(DB_KINDS.USER, USER_TOKEN_KEY, userProfile)
}

export const deleteUserData = async () => {
  return await deleteData(DB_KINDS.USER)
}

export const clearTokens = async () => {
  await deleteData(DB_KINDS.CONFIG, MAIN_TOKEN_KEY)
  await deleteData(DB_KINDS.CONFIG, USER_TOKEN_KEY)
}

export const clearAllStoredInfo = async () => {
  await Promise.all([
    deleteData(DB_KINDS.CONFIG, MAIN_TOKEN_KEY),
    deleteData(DB_KINDS.USER, USER_TOKEN_KEY),
    deleteData(DB_KINDS.SERVER, KINDS.server),
    deleteData(DB_KINDS.SERVER, 'plexSharedServersAuth'),
    deleteData(DB_KINDS.PREFERENCES, KINDS.preferences)
  ])

  // Free up space by explicitly clearing localStorage caches
  if (typeof localStorage !== 'undefined' && localStorage) {
    localStorage.removeItem('cached_users_list')
    localStorage.removeItem('cached_current_profile')
    localStorage.removeItem('app_selectedLibraries')
    
    // Clear any shared server library selections from localStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('setting:selectedLibraries_') || key.startsWith('app_selectedLibraries_'))) {
        localStorage.removeItem(key)
      }
    }
  }
}