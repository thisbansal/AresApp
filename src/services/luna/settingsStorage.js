import { DB_KINDS, getData, setData } from './lunaService'
import { deleteUserData, saveUserProfile, getUserToken } from './tokenStorage'
import { KINDS } from '../../config/app'
import { isWebOS } from '../Environment/environment'

// Global app settings (not profile-specific)
export const APP_KEYS = {
  LAST_PROFILE_ID: 'app_lastProfileId',
  PMS_SERVER: 'app_pmsServer'
}

// Per-profile settings (prefixed with profileId)
export const PROFILE_KEYS = {
  REMEMBER_PIN: 'rememberPin',
  USER_ID: 'userId',
  USER_NAME: 'userName',
  USER_PIN: 'userPin'
}

export const getSetting = async (kind, defaultValue = null) => {
  if (!isWebOS()) {
    const val = localStorage.getItem(`setting:${kind}`)
    return val !== null ? JSON.parse(val) : defaultValue
  }
  if (kind === DB_KINDS.SERVER) {
    return await getData(DB_KINDS.SERVER, KINDS.server, defaultValue)
  }
  if (kind === DB_KINDS.USER) {
    return await getData(DB_KINDS.USER, 'plexMainUser', defaultValue)
  }
  return await getData(kind, undefined, defaultValue)
}

// Batch save profile data
export const saveProfileSession = async (profileId, userName, token, pin = null, rememberPin = true, isProtected = false) => {
  const userProfileKeyDetails = {
    userId: profileId,
    userName: userName,
    userToken: token,
    userPin: pin,
    rememberPin: rememberPin,
    isProtected: isProtected
  }

  await deleteUserData()
  await saveUserProfile(userProfileKeyDetails)
}

// Get last used profile
export const getLastProfile = async () => {
  return await getUserToken()
}

// Update rememberPin setting in active profile session
export const updateRememberPinInSession = async (rememberPin) => {
  const profile = await getUserToken()
  if (profile) {
    profile.rememberPin = rememberPin
    if (!rememberPin) {
      profile.userPin = null
    }
    await saveUserProfile(profile)
  }
}

export const getSelectedLibraries = async () => {
  if (!isWebOS()) {
    const val = localStorage.getItem('app_selectedLibraries')
    return val ? JSON.parse(val) : []
  }
  return await getData(DB_KINDS.PREFERENCES, 'selectedLibraries', [])
}

export const saveSelectedLibraries = async (libraryIds) => {
  if (!isWebOS()) {
    localStorage.setItem('app_selectedLibraries', JSON.stringify(libraryIds))
    return
  }
  await setData(DB_KINDS.PREFERENCES, 'selectedLibraries', libraryIds)
}

export const getSelectedLibrariesForServer = async (serverClientId) => {
  const key = `selectedLibraries_${serverClientId}`
  if (!isWebOS()) {
    const val = localStorage.getItem(`app_${key}`)
    return val ? JSON.parse(val) : []
  }
  return await getData(DB_KINDS.PREFERENCES, key, [])
}

export const saveSelectedLibrariesForServer = async (serverClientId, libraryIds) => {
  const key = `selectedLibraries_${serverClientId}`
  if (!isWebOS()) {
    localStorage.setItem(`app_${key}`, JSON.stringify(libraryIds))
    return
  }
  await setData(DB_KINDS.PREFERENCES, key, libraryIds)
}

export const getSelectedLibrariesMap = async () => {
  if (!isWebOS()) {
    const val = localStorage.getItem('app_selectedLibrariesMap')
    return val ? JSON.parse(val) : {}
  }
  return await getData(DB_KINDS.PREFERENCES, 'selectedLibrariesMap', {})
}

export const saveSelectedLibrariesMap = async (librariesMap) => {
  if (!isWebOS()) {
    localStorage.setItem('app_selectedLibrariesMap', JSON.stringify(librariesMap))
    return
  }
  await setData(DB_KINDS.PREFERENCES, 'selectedLibrariesMap', librariesMap)
}

