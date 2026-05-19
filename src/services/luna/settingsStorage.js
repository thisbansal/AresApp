import { DB_KINDS, getData } from './lunaService'
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
export const saveProfileSession = async (profileId, userName, pin = null, rememberPin = true, isProtected = false) => {
  const userProfileKeyDetails = {
    userId: profileId,
    userName: userName,
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