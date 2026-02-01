import { getConfig, setConfig } from './lunaService'

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

// Helper to create profile-specific key
const getProfileKey = (profileId, key) => `profile_${profileId}_${key}`

// Global settings
export const saveSetting = async (key, value) => {
  return await setConfig(key, value)
}

export const getSetting = async (key, defaultValue = null) => {
  return await getConfig(key, defaultValue)
}

// Profile-specific settings
export const saveProfileSetting = async (profileId, key, value) => {
  const fullKey = getProfileKey(profileId, key)
  return await setConfig(fullKey, value)
}

export const getProfileSetting = async (profileId, key, defaultValue = null) => {
  const fullKey = getProfileKey(profileId, key)
  return await getConfig(fullKey, defaultValue)
}

// Batch save profile data
export const saveProfileSession = async (profileId, userName, pin = null, rememberPin = true) => {
  await saveProfileSetting(profileId, PROFILE_KEYS.USER_ID, profileId)
  await saveProfileSetting(profileId, PROFILE_KEYS.USER_NAME, userName)
  await saveProfileSetting(profileId, PROFILE_KEYS.REMEMBER_PIN, rememberPin)

  if (pin && rememberPin) {
    await saveProfileSetting(profileId, PROFILE_KEYS.USER_PIN, pin)
  }

  // Save as last used profile
  await saveSetting(APP_KEYS.LAST_PROFILE_ID, profileId)
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
  const lastProfileId = await getSetting(APP_KEYS.LAST_PROFILE_ID)
  if (!lastProfileId) return null

  return await getProfileSession(lastProfileId)
}