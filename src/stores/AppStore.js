import { create } from 'zustand'
import { initialiseDatabase, getMainToken, saveMainToken, clearAllStoredInfo } from '../services/luna/tokenStorage'
import { saveProfileSession, getLastProfile, updateRememberPinInSession } from '../services/luna/settingsStorage'
import { hasCompleteSession } from '../utils/appSettings'
import { getData, setData, DB_KINDS, initDeviceId } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { useServerStore } from './serverStore'

export const useAppStore = create((set, get) => ({
  isAuthenticated: false,
  hasServer: false,
  hasSession: false,
  isLoading: true,
  mainToken: null,
  token: null,
  serverUri: null,
  userProfile: null,

  initializeAuth: async () => {
    console.log('[AUTH STORE] Initializing database and loading auth state...')
    try {
      await initDeviceId()
      await initialiseDatabase()
      
      const mainToken = await getMainToken()
      const serverUri = await getData(DB_KINDS.SERVER, KINDS.server)
      const sessionComplete = await hasCompleteSession()
      const userProfile = await getLastProfile()

      const activeToken = (sessionComplete && userProfile?.userToken) ? userProfile.userToken : mainToken
      const activeServer = (sessionComplete && userProfile?.serverUri && userProfile?.serverToken)
        ? { uri: userProfile.serverUri, token: userProfile.serverToken }
        : null

      console.log('[AUTH STORE] Initialized:', {
        isAuthenticated: !!mainToken,
        hasServer: !!serverUri,
        hasSession: sessionComplete,
        userProfile,
        activeToken: activeToken ? `${activeToken.substring(0, 5)}...` : null
      })

      set({
        mainToken,
        token: activeToken,
        isAuthenticated: !!mainToken,
        serverUri,
        hasServer: !!serverUri,
        hasSession: sessionComplete,
        userProfile,
        isLoading: false
      })
      useServerStore.setState({ activeServer })
    } catch (err) {
      console.error('[AUTH STORE] Error during initializeAuth:', err)
      set({
        mainToken: null,
        token: null,
        isAuthenticated: false,
        serverUri: null,
        hasServer: false,
        hasSession: false,
        userProfile: null,
        isLoading: false
      })
      useServerStore.setState({ activeServer: null })
    }
  },

  setMainToken: async (token) => {
    console.log('[AUTH STORE] setMainToken starting...')
    try {
      await saveMainToken(token)
      const serverUri = await getData(DB_KINDS.SERVER, KINDS.server)
      const sessionComplete = await hasCompleteSession()
      const userProfile = await getLastProfile()

      const activeToken = (sessionComplete && userProfile?.userToken) ? userProfile.userToken : token

      set({
        mainToken: token,
        token: activeToken,
        isAuthenticated: !!token,
        serverUri,
        hasServer: !!serverUri,
        hasSession: sessionComplete,
        userProfile
      })
      console.log('[AUTH STORE] setMainToken completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set main token:', err)
      throw err
    }
  },

  setServerUri: async (uri) => {
    console.log('[AUTH STORE] setServerUri starting for:', uri)
    try {
      await setData(DB_KINDS.SERVER, KINDS.server, uri)
      set({
        serverUri: uri,
        hasServer: !!uri
      })
      console.log('[AUTH STORE] setServerUri completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set server URI:', err)
      throw err
    }
  },

  setProfileSession: async (profileId, userName, token, pin = null, rememberPin = true, isProtected = false, serverConnection = null) => {
    console.log('[AUTH STORE] setProfileSession starting for:', userName)
    try {
      await saveProfileSession(profileId, userName, token, pin, rememberPin, isProtected, serverConnection)
      const userProfile = await getLastProfile()
      const sessionComplete = await hasCompleteSession()

      set({
        token: token,
        userProfile,
        hasSession: sessionComplete
      })
      useServerStore.setState({ activeServer: serverConnection })
      console.log('[AUTH STORE] setProfileSession completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set profile session:', err)
      throw err
    }
  },

  signOut: async () => {
    console.log('[AUTH STORE] signOut starting...')
    try {
      await clearAllStoredInfo()
      sessionStorage.removeItem('activeSession')
      
      set({
        mainToken: null,
        token: null,
        isAuthenticated: false,
        serverUri: null,
        hasServer: false,
        hasSession: false,
        userProfile: null
      })
      useServerStore.setState({ activeServer: null })
      console.log('[AUTH STORE] signOut completed')
    } catch (err) {
      console.error('[AUTH STORE] Error during signout:', err)
      throw err
    }
  },

  updateRememberPin: async (rememberPin) => {
    console.log('[AUTH STORE] updateRememberPin starting with:', rememberPin)
    try {
      await updateRememberPinInSession(rememberPin)
      const userProfile = await getLastProfile()
      const sessionComplete = await hasCompleteSession()

      set({
        userProfile,
        hasSession: sessionComplete
      })
      console.log('[AUTH STORE] updateRememberPin completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to update rememberPin:', err)
      throw err
    }
  }
}))
