import { getUserToken } from '../services/luna/tokenStorage'

export const hasCompleteSession = async () => {
  const lastProfile = await getUserToken()

  if (!lastProfile || !lastProfile.userId) {
    return false
  }

  // If the profile is unprotected, the session is always complete
  if (lastProfile.isProtected === false) {
    console.log('Has complete session: true (unprotected profile)')
    return true
  }

  const result = !lastProfile.rememberPin || !!lastProfile.userPin
  console.log('Has complete session:', result, 'rememberPin:', lastProfile.rememberPin, 'hasPin:', !!lastProfile.userPin)

  return result
}

export const shouldAutoLogin = async () => {
  return await hasCompleteSession()
}