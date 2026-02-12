import { DB_KINDS } from '../services/luna/lunaService'
import {
  getSetting,
} from '../services/luna/settingsStorage'
import { getUserToken } from '../services/luna/tokenStorage'

export const hasCompleteSession = async () => {
  const lastProfile = await getUserToken()
  // console.log('Last profile:', lastProfile)

  if (!lastProfile || !lastProfile.userId) {
    // console.log('profile:', !!lastProfile, 'userId:', lastProfile?.userId)
    return false
  }

  const result = !lastProfile.rememberPin || !!lastProfile.userPin
  // console.log('Has complete session:', result, 'rememberPin:', lastProfile.rememberPin, 'hasPin:', !!lastProfile.userPin)

  return result
}



export const shouldAutoLogin = async () => {
  return await hasCompleteSession()
}