import { DB_KINDS } from '../services/luna/lunaService'
import {
  getSetting,
  getLastProfile,
  APP_KEYS
} from '../services/luna/settingsStorage'

export const hasCompleteSession = async () => {
  const server = await getSetting(DB_KINDS.SERVER, )
  console.log('Has server:', !!server, server)

  const lastProfile = await getLastProfile()
  console.log('Last profile:', lastProfile)

  if (!server || !lastProfile || !lastProfile.userId) {
    console.log('Missing data - server:', !!server, 'profile:', !!lastProfile, 'userId:', lastProfile?.userId)
    return false
  }

  const result = !lastProfile.rememberPin || !!lastProfile.userPin
  console.log('Has complete session:', result, 'rememberPin:', lastProfile.rememberPin, 'hasPin:', !!lastProfile.userPin)

  return result
}

export const getLastUser = async () => {
  const lastProfile = await getLastProfile()

  return {
    userId: lastProfile?.userId || null,
    userName: lastProfile?.userName || null,
    userPin: lastProfile?.userPin || null
  }
}

export const shouldAutoLogin = async () => {
  return await hasCompleteSession()
}