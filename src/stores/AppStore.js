import { create } from 'zustand'
import { initialiseDatabase, getMainToken, saveMainToken, clearAllStoredInfo } from '../services/luna/tokenStorage'
import { saveProfileSession, getLastProfile, updateRememberPinInSession, getSelectedLibraries, saveSelectedLibraries, getSelectedLibrariesForServer, saveSelectedLibrariesForServer } from '../services/luna/settingsStorage'
import { hasCompleteSession } from '../utils/appSettings'
import { getData, setData, DB_KINDS, initDeviceId } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { useServerStore } from './serverStore'
import { verifyGlobalToken } from '../services/plex/tokenVerificationService'

export const useAppStore = create((set, get) => ({
  isAuthenticated: false,
  hasServer: false,
  hasLibraries: false,
  hasSession: false,
  isLoading: true,
  mainToken: null,
  token: null,
  serverUri: null,
  setupServerToken: null,
  selectedLibraryIds: [],
  selectedLibrariesByServer: {}, // Maps serverClientId -> libraryIds[]
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
            serverUri: null,
            setupServerToken: null,
            hasServer: false,
            hasSession: false,
            userProfile: null,
            isLoading: false
          })
          useServerStore.setState({ activeServer: null })
          return
        }
      }

      const serverData = await getData(DB_KINDS.SERVER, KINDS.server)
      const serverUri = typeof serverData === 'string' ? serverData : serverData?.uri
      const setupServerToken = typeof serverData === 'object' ? serverData?.token : null
      
      const selectedLibraries = await getSelectedLibraries()
      const sessionComplete = await hasCompleteSession()
      const userProfile = await getLastProfile()

      const sharedServersAuth = await getData(DB_KINDS.SERVER, 'plexSharedServersAuth') || {}
      const selectedLibrariesByServer = {}
      for (const clientId of Object.keys(sharedServersAuth)) {
        selectedLibrariesByServer[clientId] = await getSelectedLibrariesForServer(clientId)
      }

      const activeToken = (sessionComplete && userProfile?.userToken) ? userProfile.userToken : mainToken
      const activeServer = (sessionComplete && userProfile?.serverUri && userProfile?.serverToken)
        ? { uri: userProfile.serverUri, token: userProfile.serverToken, owned: userProfile.serverOwned ?? true }
        : null

      const hasLibraries = selectedLibraries.length > 0 || Object.values(selectedLibrariesByServer).some(libs => libs.length > 0)

      console.log('[AUTH STORE] Initialized:', {
        isAuthenticated: !!mainToken,
        hasServer: !!serverUri,
        hasLibraries,
        hasSession: sessionComplete,
        userProfile,
        activeToken: activeToken ? `${activeToken.substring(0, 5)}...` : null
      })

      set({
        mainToken,
        token: activeToken,
        isAuthenticated: !!mainToken,
        serverUri,
        setupServerToken,
        hasServer: !!serverUri || Object.keys(selectedLibrariesByServer).length > 0,
        selectedLibraryIds: selectedLibraries,
        selectedLibrariesByServer,
        hasLibraries,
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
        setupServerToken: null,
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

  setServerUri: async (uri, setupServerToken = null) => {
    console.log('[AUTH STORE] setServerUri starting for:', uri)
    try {
      if (get().serverUri === uri) {
        console.log('[AUTH STORE] Server URI is identical. Skipping library selection reset.')
        return
      }
      const serverData = setupServerToken ? { uri, token: setupServerToken } : uri
      await setData(DB_KINDS.SERVER, KINDS.server, serverData)
      set({
        serverUri: uri,
        setupServerToken,
        hasServer: !!uri,
        hasLibraries: false, // Reset libraries when server changes
        selectedLibraryIds: []
      })
      await saveSelectedLibraries([])
      console.log('[AUTH STORE] setServerUri completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set server URI:', err)
      throw err
    }
  },

  setSelectedLibraries: async (libraryIds) => {
    console.log('[AUTH STORE] setSelectedLibraries starting')
    try {
      await saveSelectedLibraries(libraryIds)
      set({
        selectedLibraryIds: libraryIds,
        hasLibraries: libraryIds.length > 0 || Object.values(get().selectedLibrariesByServer).some(libs => libs.length > 0)
      })
      console.log('[AUTH STORE] setSelectedLibraries completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set libraries:', err)
      throw err
    }
  },

  setSelectedLibrariesForServer: async (serverClientId, libraryIds) => {
    console.log(`[AUTH STORE] setSelectedLibrariesForServer starting for: ${serverClientId}`)
    try {
      await saveSelectedLibrariesForServer(serverClientId, libraryIds)
      const updatedMap = {
        ...get().selectedLibrariesByServer,
        [serverClientId]: libraryIds
      }
      set({
        selectedLibrariesByServer: updatedMap,
        hasServer: true,
        hasLibraries: get().selectedLibraryIds.length > 0 || Object.values(updatedMap).some(libs => libs.length > 0)
      })
      console.log('[AUTH STORE] setSelectedLibrariesForServer completed')
    } catch (err) {
      console.error('[AUTH STORE] Failed to set libraries for server:', err)
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
      if (serverConnection) {
        useServerStore.setState({ activeServer: { uri: serverConnection.uri, token: serverConnection.token, owned: serverConnection.owned ?? true } })
      }
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
        serverUri: null,
        setupServerToken: null,
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
        serverUri: null,
        setupServerToken: null,
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
