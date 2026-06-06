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

export const LAST_PROFILE_ID_KEY = 'lastActiveProfileId'

export const saveLastActiveProfileId = async (profileId) => {
  return await setData(DB_KINDS.CONFIG, LAST_PROFILE_ID_KEY, profileId)
}

export const getLastActiveProfileId = async () => {
  return await getData(DB_KINDS.CONFIG, LAST_PROFILE_ID_KEY)
}

export const getStoredProfilesList = async () => {
  return await getData(DB_KINDS.CONFIG, 'storedProfilesList', [])
}

export const saveStoredProfilesList = async (list) => {
  return await setData(DB_KINDS.CONFIG, 'storedProfilesList', list)
}

export const getUserToken = async () => {
  const lastId = await getLastActiveProfileId()
  if (!lastId) return null
  return await getData(DB_KINDS.USER, `profile_${lastId}`)
}

export const getUserProfile = async (profileId) => {
  return await getData(DB_KINDS.USER, `profile_${profileId}`)
}

export const getDB8Kind = async (kind, key) => {
  return await getData(kind, key)
}

// User-specific profile settings
export const saveUserProfile = async (userProfile) => {
  if (!userProfile || !userProfile.userId) return
  await setData(DB_KINDS.USER, `profile_${userProfile.userId}`, userProfile)
  
  const list = await getStoredProfilesList()
  if (!list.includes(userProfile.userId)) {
    list.push(userProfile.userId)
    await saveStoredProfilesList(list)
  }
  
  await saveLastActiveProfileId(userProfile.userId)
}

export const deleteUserData = async (profileId = null) => {
  if (profileId) {
    await deleteData(DB_KINDS.USER, `profile_${profileId}`)
    const list = await getStoredProfilesList()
    const updated = list.filter(id => id !== profileId)
    await saveStoredProfilesList(updated)
    
    const lastId = await getLastActiveProfileId()
    if (lastId === profileId) {
      await deleteData(DB_KINDS.CONFIG, LAST_PROFILE_ID_KEY)
    }
  } else {
    const lastId = await getLastActiveProfileId()
    if (lastId) {
      await deleteData(DB_KINDS.USER, `profile_${lastId}`)
      await deleteData(DB_KINDS.CONFIG, LAST_PROFILE_ID_KEY)
      const list = await getStoredProfilesList()
      const updated = list.filter(id => id !== lastId)
      await saveStoredProfilesList(updated)
    }
  }
}

export const clearTokens = async () => {
  await deleteData(DB_KINDS.CONFIG, MAIN_TOKEN_KEY)
  const lastId = await getLastActiveProfileId()
  if (lastId) {
    await deleteData(DB_KINDS.USER, `profile_${lastId}`)
  }
}

export const clearAllStoredInfo = async () => {
  const list = await getStoredProfilesList()
  
  const promises = [
    deleteData(DB_KINDS.CONFIG, MAIN_TOKEN_KEY),
    deleteData(DB_KINDS.CONFIG, LAST_PROFILE_ID_KEY),
    deleteData(DB_KINDS.CONFIG, 'storedProfilesList'),
    deleteData(DB_KINDS.SERVER, KINDS.server),
    deleteData(DB_KINDS.SERVER, 'plexSharedServersAuth'),
    deleteData(DB_KINDS.PREFERENCES, KINDS.preferences)
  ]
  
  // Clear all profile sessions
  for (const profileId of list) {
    promises.push(deleteData(DB_KINDS.USER, `profile_${profileId}`))
  }
  
  await Promise.all(promises)

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