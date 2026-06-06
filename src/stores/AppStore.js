import { create } from 'zustand'
import { initialiseDatabase, getMainToken, saveMainToken, clearAllStoredInfo } from '../services/luna/tokenStorage'
import { saveProfileSession, getLastProfile, updateRememberPinInSession, getSelectedLibraries, saveSelectedLibraries } from '../services/luna/settingsStorage'
import { hasCompleteSession } from '../utils/appSettings'
import { getData, setData, DB_KINDS, initDeviceId } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { useServerStore } from './serverStore'
import { verifyGlobalToken } from '../services/plex/tokenVerificationService'
import { useServerManagerStore } from './serverManagerStore'

export const useAppStore = create((set, get) => ({
  isAuthenticated: false,
  hasServer: false,
  hasLibraries: false,
  hasSession: false,
  isLoading: true,
  mainToken: null,
  token: null,
  selectedLibraries: [],
  userProfile: null,

  initializeAuth: async () => {
    console.log('[AUTH STORE] Initializing database and loading auth state...')
    try {
      await initDeviceId()
      await initialiseDatabase()

      const mainToken = await getMainToken()

      if (mainToken) {
        const isGlobalTokenValid = await verifyGlobalToken(mainToken)
        if (!isGlobalTokenValid) {
          console.warn('[AUTH STORE] Global token is invalid. Signing out.')
          await clearAllStoredInfo()
          sessionStorage.removeItem('activeSession')
          set({
            mainToken: null,
            token: null,
            isAuthenticated: false,
            hasServer: false,
            hasSession: false,
            userProfile: null,
            isLoading: false
          })
          useServerStore.setState({ activeServer: null })
          return
        }
      }


      const userProfile = await getLastProfile()
      const profileId = userProfile?.userId || 'default'
      const sessionComplete = await hasCompleteSession()
      const activeToken = (sessionComplete && userProfile?.userToken) ? userProfile.userToken : mainToken

      await useServerManagerStore.getState().loadCachedServers(activeToken, profileId)
      // Kick off background discovery so new servers are added and offline ones update their status
      useServerManagerStore.getState().discoverAllServers(activeToken)

      const selectedLibraries = await getSelectedLibraries(profileId)

      const hasServers = Object.keys(useServerManagerStore.getState().servers).length > 0
      const hasLibraries = selectedLibraries.length > 0

      console.log('[AUTH STORE] Initialized')

      set({
        mainToken,
        token: activeToken,
        isAuthenticated: !!mainToken,
        hasServer: hasServers,
        selectedLibraries,
        hasLibraries,
        hasSession: sessionComplete,
        userProfile,
        isLoading: false
      })
    } catch (err) {
      console.error('[AUTH STORE] Error during initializeAuth:', err)
      set({
        mainToken: null,
        token: null,
        isAuthenticated: false,
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
      const hasServers = Object.keys(useServerManagerStore.getState().servers).length > 0
      const sessionComplete = await hasCompleteSession()
      const userProfile = await getLastProfile()

      const activeToken = (sessionComplete && userProfile?.userToken) ? userProfile.userToken : token

      set({
        mainToken: token,
        token: activeToken,
        isAuthenticated: !!token,
        hasServer: hasServers,
        hasSession: sessionComplete,
        userProfile
      })
      console.log('[AUTH STORE] setMainToken completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set main token:', err)
      throw err
    }
  },

  // Removed setServerUri (handled by serverManagerStore)

  setSelectedLibraries: async (libraries) => {
    console.log('[AUTH STORE] setSelectedLibraries starting')
    try {
      const profileId = get().userProfile?.userId || 'default'
      await saveSelectedLibraries(libraries, profileId)
      set({
        selectedLibraries: libraries,
        hasLibraries: libraries.length > 0
      })
      console.log('[AUTH STORE] setSelectedLibraries completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set libraries:', err)
      throw err
    }
  },

  setProfileSession: async (profileId, userName, token, pin = null, rememberPin = true, isProtected = false) => {
    console.log('[AUTH STORE] setProfileSession starting for:', userName)
    try {
      await saveProfileSession(profileId, userName, token, pin, rememberPin, isProtected)
      const userProfile = await getLastProfile()
      const sessionComplete = await hasCompleteSession()

      set({
        token: token,
        userProfile,
        hasSession: sessionComplete
      })

      // Kick off server discovery on profile switch
      useServerManagerStore.getState().discoverAllServers(token)

      console.log('[AUTH STORE] setProfileSession completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set profile session:', err)
      throw err
    }
  },

  handleServerAuthError: async () => {
    console.log('[AUTH STORE] Handling server 401 error...')
    const { mainToken } = get()
    if (!mainToken) {
      await get().signOut()
      return
    }

    const isGlobalTokenValid = await verifyGlobalToken(mainToken)
    if (!isGlobalTokenValid) {
      console.warn('[AUTH STORE] Global token invalid during server error. Signing out.')
      await get().signOut()
    } else {
      console.log('[AUTH STORE] Global token valid, but server access lost. Clearing active server.')
      set({
        hasServer: false,
        token: mainToken
      })
      useServerStore.setState({ activeServer: null })
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
