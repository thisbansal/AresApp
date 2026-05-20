import { create } from 'zustand'
import { initialiseDatabase, getMainToken, saveMainToken, clearAllStoredInfo } from '../services/luna/tokenStorage'
import { saveProfileSession, getLastProfile, updateRememberPinInSession } from '../services/luna/settingsStorage'
import { hasCompleteSession } from '../utils/appSettings'
import { getData, setData, DB_KINDS } from '../services/luna/lunaService'
import { KINDS } from '../config/app'

export const useAppStore = create((set, get) => ({
  isAuthenticated: false,
  hasServer: false,
  hasSession: false,
  isLoading: true,
  token: null,
  serverUri: null,
  userProfile: null,

  initializeAuth: async () => {
    console.log('[AUTH STORE] Initializing database and loading auth state...')
    try {
      await initialiseDatabase()
      
      const token = await getMainToken()
      const serverUri = await getData(DB_KINDS.SERVER, KINDS.server)
      const sessionComplete = await hasCompleteSession()
      const userProfile = await getLastProfile()

      console.log('[AUTH STORE] Initialized:', {
        isAuthenticated: !!token,
        hasServer: !!serverUri,
        hasSession: sessionComplete,
        userProfile
      })

      set({
        token,
        isAuthenticated: !!token,
        serverUri,
        hasServer: !!serverUri,
        hasSession: sessionComplete,
        userProfile,
        isLoading: false
      })
    } catch (err) {
      console.error('[AUTH STORE] Error during initializeAuth:', err)
      set({
        token: null,
        isAuthenticated: false,
        serverUri: null,
        hasServer: false,
        hasSession: false,
        userProfile: null,
        isLoading: false
      })
    }
  },

  setMainToken: async (token) => {
    console.log('[AUTH STORE] setMainToken starting...')
    try {
      await saveMainToken(token)
      const serverUri = await getData(DB_KINDS.SERVER, KINDS.server)
      const sessionComplete = await hasCompleteSession()
      const userProfile = await getLastProfile()

      set({
        token,
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

  setProfileSession: async (profileId, userName, pin = null, rememberPin = true, isProtected = false) => {
    console.log('[AUTH STORE] setProfileSession starting for:', userName)
    try {
      await saveProfileSession(profileId, userName, pin, rememberPin, isProtected)
      const userProfile = await getLastProfile()
      const sessionComplete = await hasCompleteSession()

      set({
        userProfile,
        hasSession: sessionComplete
      })
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
        token: null,
        isAuthenticated: false,
        serverUri: null,
        hasServer: false,
        hasSession: false,
        userProfile: null
      })
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