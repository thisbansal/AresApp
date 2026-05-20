import { getUserToken } from '../services/luna/tokenStorage'

export const hasCompleteSession = async () => {
  const lastProfile = await getUserToken()

  if (!lastProfile || !lastProfile.userId) {
    return false
  }

  // If there is an active session in the current app run, it is always complete
  if (sessionStorage.getItem('activeSession') === 'true') {
    console.log('Has complete session: true (sessionStorage activeSession is set)')
    return true
  }

  // Otherwise, if the user chose NOT to auto-login (rememberPin is false), the session is incomplete on startup
  if (lastProfile.rememberPin === false) {
    console.log('Has complete session: false (rememberPin is false)')
    return false
  }

  // If the profile is unprotected and rememberPin is true, it is complete
  if (lastProfile.isProtected === false) {
    console.log('Has complete session: true (unprotected profile and auto-login is enabled)')
    return true
  }

  // For protected profile, we need the stored userPin
  const result = !!lastProfile.userPin
  console.log('Has complete session:', result, 'rememberPin:', lastProfile.rememberPin, 'hasPin:', !!lastProfile.userPin)

  return result
}

export const shouldAutoLogin = async () => {
  return await hasCompleteSession()
}