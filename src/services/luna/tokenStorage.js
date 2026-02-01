import { getConfig, setConfig, deleteConfig } from './lunaService'

const MAIN_TOKEN_KEY = 'plexMainToken'
const USER_TOKEN_KEY = 'plexUserToken'

// Main account token (for getting users, servers, etc.)
export const saveMainToken = async (token) => {
  return await setConfig(MAIN_TOKEN_KEY, token)
}

export const getMainToken = async () => {
  return await getConfig(MAIN_TOKEN_KEY)
}

// User-specific token (for accessing content as that user)
export const saveUserToken = async (token) => {
  return await setConfig(USER_TOKEN_KEY, token)
}

export const getUserToken = async () => {
  return await getConfig(USER_TOKEN_KEY)
}

// Legacy - for backwards compatibility, returns user token if exists, else main token
export const getToken = async () => {
  const userToken = await getUserToken()
  if (userToken) return userToken
  return await getMainToken()
}

export const saveToken = async (token) => {
  // Default to saving as main token
  return await saveMainToken(token)
}

export const clearTokens = async () => {
  await deleteConfig(MAIN_TOKEN_KEY)
  await deleteConfig(USER_TOKEN_KEY)
}