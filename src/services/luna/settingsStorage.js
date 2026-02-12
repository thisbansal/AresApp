import { DB_KINDS, deleteData, getData, setData } from './lunaService'
import { deleteUserData, saveUserProfile } from './tokenStorage'

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

export const getSetting = async (key, defaultValue = null) => {
  return await getData(key, defaultValue)
}

export const getProfileSetting = async (profileId, key, defaultValue = null) => {
  const fullKey = getProfileKey(profileId, key)
  return await getConfig(fullKey, defaultValue)
}

// Batch save profile data
export const saveProfileSession = async (profileId, userName, pin = null, rememberPin = true) => {
  const userProfileKeyDetails = {
    userId: profileId,
    userName: userName,
    userPin: pin,
    rememberPin: rememberPin
  }

  await deleteUserData()
  await saveUserProfile(userProfileKeyDetails)
}

// Get profile data
export const getProfileSession = async (profileId) => {
  return {
    userId: await getProfileSetting(profileId, PROFILE_KEYS.USER_ID),
    userName: await getProfileSetting(profileId, PROFILE_KEYS.USER_NAME),
    userPin: await getProfileSetting(profileId, PROFILE_KEYS.USER_PIN),
    rememberPin: await getProfileSetting(profileId, PROFILE_KEYS.REMEMBER_PIN, true)
  }
}

// Get last used profile
export const getLastProfile = async () => {
  const lastProfileId = await getSetting(DB_KINDS.USER)
  if (!lastProfileId) return null

  return await getProfileSession(lastProfileId)
}