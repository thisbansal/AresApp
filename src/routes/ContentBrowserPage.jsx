import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { NavigationBar } from '../components/navigational/NavigationBar'
import { FallbackImage } from '../components/media/FallbackImage'
import { useAppStore } from '../stores/AppStore'
import { DB_KINDS, getData, setData } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { testConnectionToServer, getServers } from '../services/plex/plexAPIServer'
import { resolveAccessibleServer } from '../services/plex/plexAccessService'
import { getLibraries, getLibraryItems, buildImageUrl } from '../services/plex/plexContentService'
import { multiServerCacheService, CACHE_KEYS_MULTI } from '../services/caching/multiServerCacheService'
import { isMediaWatched } from '../services/plex/plexWatchedService'
import { useToggleWatched } from '../hooks/useToggleWatched'
import { useBrowserStore } from '../stores/browserStore'
import { useSpatialNavigation } from '../contexts/SpatialNavigationContext'
import { useServerStore } from '../stores/serverStore'
import { getUsers, verifyUserPin } from '../services/plex/plexAuthService'
import { resolveMediaNavigation } from '../utils/mediaNavigation'
import { getMainToken } from '../services/luna/tokenStorage'
import { useServerManagerStore } from '../stores/serverManagerStore'


// Module-level cache to persist clicked item ID across route transitions (for back morph animations)
let globalClickedItemId = null

function ContentBrowserPage() {
  const navigate = useNavigate()

  // State
  const [clickedItemId, setClickedItemId] = useState(globalClickedItemId)

  // State
  const [serverInfo, setServerInfo] = useState(null)
  const [libraries, setLibraries] = useState([])
  const { navigationMode, setNavigationMode, lastRemoteActionRef } = useSpatialNavigation()
  const activeTab = useBrowserStore((state) => state.activeTab)
  const setActiveTab = useBrowserStore((state) => state.setActiveTab)

  // Content State
  const continueWatching = useBrowserStore((state) => state.continueWatching)
  const setContinueWatching = useBrowserStore((state) => state.setContinueWatching)
  const recentMovies = useBrowserStore((state) => state.recentMovies)
  const setRecentMovies = useBrowserStore((state) => state.setRecentMovies)
  const recentTv = useBrowserStore((state) => state.recentTv)
  const setRecentTv = useBrowserStore((state) => state.setRecentTv)
  const libraryContent = useBrowserStore((state) => state.libraryContent)
  const setLibraryContent = useBrowserStore((state) => state.setLibraryContent)

  // Settings State from Store
  const subtitleWeight = useBrowserStore((state) => state.subtitleWeight)
  const setSubtitleWeight = useBrowserStore((state) => state.setSubtitleWeight)
  const subtitleColor = useBrowserStore((state) => state.subtitleColor)
  const setSubtitleColor = useBrowserStore((state) => state.setSubtitleColor)
  const subtitleSize = useBrowserStore((state) => state.subtitleSize)
  const setSubtitleSize = useBrowserStore((state) => state.setSubtitleSize)
  const showSubtitleHUDControls = useBrowserStore((state) => state.showSubtitleHUDControls)
  const setShowSubtitleHUDControls = useBrowserStore((state) => state.setShowSubtitleHUDControls)
  const showUnwatchedIndicator = useBrowserStore((state) => state.showUnwatchedIndicator)
  const setShowUnwatchedIndicator = useBrowserStore((state) => state.setShowUnwatchedIndicator)

  const selectedLibraryIds = useAppStore((state) => state.selectedLibraryIds)
  const selectedLibrariesByServer = useAppStore((state) => state.selectedLibrariesByServer)

  const [loading, setLoading] = useState(true)
  const toggleWatched = useToggleWatched(serverInfo)

  // Settings-specific and Profile Switcher State
  const [currentProfile, setCurrentProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_current_profile')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [usersList, setUsersList] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_users_list')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [pinDialogUser, setPinDialogUser] = useState(null)
  const [enteredPin, setEnteredPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [showSignoutConfirm, setShowSignoutConfirm] = useState(false)

  // Shared Server State
  const [sharedServers, setSharedServers] = useState([])
  const [showSharedLibModal, setShowSharedLibModal] = useState(false)
  const [targetSharedServer, setTargetSharedServer] = useState(null)
  const [modalLibraries, setModalLibraries] = useState([])
  const [modalSelectedIds, setModalSelectedIds] = useState([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    if (activeTab.type === 'settings') {
      const loadSettingsData = async () => {
        try {
          const profile = useAppStore.getState().userProfile
          if (profile) {
            setCurrentProfile(profile)
            localStorage.setItem('cached_current_profile', JSON.stringify(profile))
          }

          const mainToken = useAppStore.getState().mainToken || await getMainToken()
          if (mainToken) {
            const list = await getUsers(mainToken)
            setUsersList(list)
            localStorage.setItem('cached_users_list', JSON.stringify(list))

            // Fetch servers and filter for shared ones
            try {
              const allServers = await getServers(mainToken, { ownedOnly: false })
              const shared = allServers.filter(s => !s.owned)
              setSharedServers(shared)
            } catch (err) {
              console.error('[Settings] Error fetching servers for settings:', err)
            }
          }
        } catch (e) {
          console.error('[Settings] Error loading profiles:', e)
        }
      }
      loadSettingsData()
    }
  }, [activeTab])

  // Handle keypresses for D-pad numeric inputs in settings PIN dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (pinDialogUser) {
        if (e.key >= '0' && e.key <= '9') {
          if (enteredPin.length < 4) {
            const newPin = enteredPin + e.key
            setEnteredPin(newPin)
            if (newPin.length === 4) {
              setTimeout(() => handlePinSubmit(newPin), 200)
            }
          }
        } else if (e.key === 'Backspace') {
          setEnteredPin(prev => prev.slice(0, -1))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pinDialogUser, enteredPin])

  const handleProfileSwitch = async (user) => {
    console.log('[Settings] Request to switch to user:', user.name)
    if (user.protected) {
      setPinDialogUser(user)
      setEnteredPin('')
      setPinError('')
    } else {
      try {
        const mainToken = useAppStore.getState().mainToken || await getMainToken()
        const userToken = await verifyUserPin(mainToken, user.id, "")
        const preferredUri = useAppStore.getState().serverUri
        const resolvedServer = await resolveAccessibleServer(userToken, preferredUri)
        const serverConnection = resolvedServer ? { uri: resolvedServer.uri, token: resolvedServer.token } : null
        sessionStorage.setItem('activeSession', 'true')
        if (resolvedServer?.uri && resolvedServer.uri !== preferredUri) {
          await useAppStore.getState().setServerUri(resolvedServer.uri)
        }
        await useAppStore.getState().setProfileSession(user.id, user.name, userToken, null, false, false, serverConnection)
        const newProfile = useAppStore.getState().userProfile
        localStorage.setItem('cached_current_profile', JSON.stringify(newProfile))
        window.location.reload()
      } catch (err) {
        console.error('[Settings] Failed to switch profile:', err)
      }
    }
  }

  const handlePinSubmit = async (pin) => {
    if (pin.length !== 4) {
      setPinError('Please enter a 4-digit PIN')
      setEnteredPin('')
      return
    }

    try {
      const mainToken = useAppStore.getState().mainToken || await getMainToken()
      const userToken = await verifyUserPin(mainToken, pinDialogUser.id, pin)

      if (userToken) {
        const preferredUri = useAppStore.getState().serverUri
        const resolvedServer = await resolveAccessibleServer(userToken, preferredUri)
        const serverConnection = resolvedServer ? { uri: resolvedServer.uri, token: resolvedServer.token } : null
        sessionStorage.setItem('activeSession', 'true')
        if (resolvedServer?.uri && resolvedServer.uri !== preferredUri) {
          await useAppStore.getState().setServerUri(resolvedServer.uri)
        }
        await useAppStore.getState().setProfileSession(pinDialogUser.id, pinDialogUser.name, userToken, pin, false, true, serverConnection)
        const newProfile = useAppStore.getState().userProfile
        localStorage.setItem('cached_current_profile', JSON.stringify(newProfile))
        window.location.reload()
      } else {
        setPinError('Incorrect PIN. Try again.')
        setEnteredPin('')
      }
    } catch (err) {
      console.error('[Settings] PIN verification failed:', err)
      setPinError('Incorrect PIN. Try again.')
      setEnteredPin('')
    }
  }

  const handleToggleRememberPin = async () => {
    if (!currentProfile) return
    const newValue = currentProfile.rememberPin === false ? true : false
    try {
      await useAppStore.getState().updateRememberPin(newValue)
      const updated = useAppStore.getState().userProfile
      setCurrentProfile(updated)
      localStorage.setItem('cached_current_profile', JSON.stringify(updated))
    } catch (err) {
      console.error('[Settings] Failed to update remember pin:', err)
    }
  }

  const handleSwitchProfileClick = async () => {
    console.log('[Settings] Switch profile clicked. Disabling auto-login/rememberPin for current session...')
    try {
      await useAppStore.getState().updateRememberPin(false)
      const updated = useAppStore.getState().userProfile
      if (updated) {
        setCurrentProfile(updated)
        localStorage.setItem('cached_current_profile', JSON.stringify(updated))
      }
      sessionStorage.removeItem('activeSession')
      window.location.reload()
    } catch (err) {
      console.error('[Settings] Failed to switch profile:', err)
    }
  }

  const ITEMS_PER_ROW = 6

  const loadAllSelectedLibraries = async (ownUri = null, ownToken = null) => {
    try {
      const activeOwnUri = ownUri || serverInfo?.uri || useServerStore.getState().activeServer?.uri
      const activeOwnToken = ownToken || serverInfo?.token || useServerStore.getState().activeServer?.token
      
      const allNavLibs = []

      // 1. Load own libraries
      if (activeOwnUri && activeOwnToken) {
        try {
          const ownLibs = await getLibraries(activeOwnUri, activeOwnToken)
          const ownSelectedIds = useAppStore.getState().selectedLibraryIds || []
          const ownFiltered = ownLibs.filter(l => ownSelectedIds.includes(l.id))
            
          allNavLibs.push(...ownFiltered.map(l => ({
            ...l,
            isShared: false,
            serverUri: activeOwnUri,
            token: activeOwnToken
          })))
        } catch (e) {
          console.warn('[init] Failed to get own libraries:', e)
        }
      }

      // 2. Load shared libraries
      const mainToken = useAppStore.getState().mainToken || await getMainToken()
      if (mainToken) {
        const selectedLibrariesByServer = useAppStore.getState().selectedLibrariesByServer || {}
        
        // Sort server clientIds stably to prevent key insertion order from swapping tabs in navbar
        const sortedServerEntries = Object.entries(selectedLibrariesByServer).sort((a, b) => a[0].localeCompare(b[0]))
        
        for (const [clientId, selectedIds] of sortedServerEntries) {
          if (selectedIds && selectedIds.length > 0) {
            try {
              const servers = useServerManagerStore.getState().servers
              const sharedInfo = servers[clientId]
              if (sharedInfo && sharedInfo.uri && sharedInfo.accessToken) {
                const sharedLibs = await getLibraries(sharedInfo.uri, sharedInfo.accessToken)
                const sharedFiltered = sharedLibs.filter(l => selectedIds.includes(l.id))
                allNavLibs.push(...sharedFiltered.map(l => ({
                  ...l,
                  isShared: true,
                  serverClientId: clientId,
                  serverUri: sharedInfo.uri,
                  token: sharedInfo.accessToken
                })))
              }
            } catch (err) {
              console.error(`[init] Failed to load shared libraries for server ${clientId}:`, err)
            }
          }
        }
      }

      setLibraries(allNavLibs)
      
      if (activeTab && activeTab.type === 'library') {
        const stillExists = allNavLibs.some(l => l.id === activeTab.data?.id)
        if (!stillExists) {
          console.log('[ContentBrowserPage] Active library tab no longer selected. Resetting to Home.')
          setActiveTab({ type: 'home' })
        }
      }
    } catch (err) {
      console.error('[loadAllSelectedLibraries] Error:', err)
    }
  }

  // 1. Initialise Server Info and Libraries
  useEffect(() => {
    const initServerAndNav = async () => {
      try {
        const token = useAppStore.getState().token
        if (!token) return
        const storedActiveServer = useServerStore.getState().activeServer

        // Load Settings
        let prefs = await getData(DB_KINDS.PREFERENCES, KINDS.preferences)
        if (prefs) {
          if (prefs.showUnwatchedIndicator !== undefined) setShowUnwatchedIndicator(prefs.showUnwatchedIndicator)
          if (prefs.subtitleWeight !== undefined) setSubtitleWeight(prefs.subtitleWeight)
          if (prefs.subtitleColor !== undefined) setSubtitleColor(prefs.subtitleColor)
          if (prefs.subtitleSize !== undefined) setSubtitleSize(prefs.subtitleSize)
          if (prefs.showSubtitleHUDControls !== undefined) setShowSubtitleHUDControls(prefs.showSubtitleHUDControls)
        }

        // 1. Fast Path: Try to boot instantly using the last known server address
        let currentUri = storedActiveServer?.uri || await getData(DB_KINDS.SERVER, KINDS.server)
        const currentToken = storedActiveServer?.token || token
        let isCurrentHealthy = false

        if (currentUri) {
          console.log('[init] Trying fast path:', currentUri)

          // Test health quickly (1500ms timeout)
          const startTime = Date.now()
          const healthy = await testConnectionToServer(currentUri, currentToken, 1500)
          const duration = Date.now() - startTime

          if (healthy) {
            console.log(`[init] Fast path healthy (${duration}ms). Loading libraries...`)
            isCurrentHealthy = true
            const fastPathServer = { uri: currentUri, token: currentToken }
            setServerInfo(fastPathServer)
            useServerStore.setState({ activeServer: fastPathServer })
            loadAllSelectedLibraries(currentUri, currentToken).catch(e => console.warn('Fast path loadAllSelectedLibraries failed:', e))

            // If it's a fast local connection, we're done. No need to hit Plex.tv.
            if (!currentUri.includes('relay')) {
              console.log('[init] Staying on healthy local connection. Skipping background discovery.')
              return
            }
          } else {
            console.warn('[init] Fast path URI unreachable. Starting discovery...')
          }
        }

        // 2. Background Check/Discovery: Only if current is unhealthy or a relay
        console.log('[init] Running token-aware server discovery...')
        const resolvedServer = await resolveAccessibleServer(token, currentUri)

        if (resolvedServer?.uri && resolvedServer.uri !== currentUri) {
          console.log('[init] Found reachable server for active profile:', resolvedServer.uri)
          await setData(DB_KINDS.SERVER, KINDS.server, resolvedServer.uri)
          const nextServerInfo = { uri: resolvedServer.uri, token: resolvedServer.token }
          setServerInfo(nextServerInfo)
          useServerStore.setState({ activeServer: nextServerInfo })
          loadAllSelectedLibraries(resolvedServer.uri, resolvedServer.token).catch(e => console.warn('Background loadAllSelectedLibraries failed:', e))
        } else if (!isCurrentHealthy && resolvedServer?.uri) {
          console.log('[init] Reusing stored server for active profile:', resolvedServer.uri)
          const nextServerInfo = { uri: resolvedServer.uri, token: resolvedServer.token }
          setServerInfo(nextServerInfo)
          useServerStore.setState({ activeServer: nextServerInfo })
          loadAllSelectedLibraries(resolvedServer.uri, resolvedServer.token).catch(e => console.warn('Background loadAllSelectedLibraries failed:', e))
        }
      } catch (error) {
        console.error('[initServerAndNav] Error:', error)
      }
    }
    initServerAndNav()
  }, [])

  // 1b. Reload libraries dynamically if selections change (e.g. from Settings Library Select)
  useEffect(() => {
    if (serverInfo?.uri && serverInfo?.token) {
      loadAllSelectedLibraries(serverInfo.uri, serverInfo.token).catch(e => console.warn('[init] Reactive reload failed:', e))
    }
  }, [selectedLibraryIds, selectedLibrariesByServer, serverInfo])

  // Helper to preload images before showing content
  const preloadImages = async (itemsArrays) => {
    // Flatten arrays and take up to 24 images (enough for initial screen load)
    const urls = itemsArrays.flat().slice(0, 24).map(item => item.thumb).filter(Boolean)

    await Promise.all(urls.map(url => {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = (e) => {
          console.error('[ContentBrowser] Preload failed for:', url)
          resolve()
        } // Resolve even on error to prevent hanging
        img.src = url
      })
    }))
  }

  // 2. Fetch Content when Tab or Server changes
  useEffect(() => {
    if (!serverInfo) return

    const fetchContent = async () => {
      setLoading(true)
      try {
        if (activeTab.type === 'home') {
          // Fire off requests to the local cache instantly
          const [onDeckData, recentData] = await Promise.all([
            multiServerCacheService.getOnDeck(),
            multiServerCacheService.getRecentlyAdded()
          ])

          await preloadImages([onDeckData, recentData])

          setContinueWatching(onDeckData)
          setRecentMovies(recentData.filter(i => i.type === 'movie'))
          setRecentTv(recentData.filter(i => ['show', 'season', 'episode'].includes(i.type)))

          // Subscribe to background sync updates
          const unsubOnDeck = multiServerCacheService.subscribe(CACHE_KEYS_MULTI.ON_DECK, async (newData) => {
            await preloadImages([newData])
            setContinueWatching(newData)
          })
          const unsubRecent = multiServerCacheService.subscribe(CACHE_KEYS_MULTI.RECENTLY_ADDED, async (newData) => {
            await preloadImages([newData])
            setRecentMovies(newData.filter(i => i.type === 'movie'))
            setRecentTv(newData.filter(i => ['show', 'season', 'episode'].includes(i.type)))
          })

          return () => {
            unsubOnDeck()
            unsubRecent()
            multiServerCacheService.stopBackgroundSync(CACHE_KEYS_MULTI.ON_DECK)
            multiServerCacheService.stopBackgroundSync(CACHE_KEYS_MULTI.RECENTLY_ADDED)
          }

        } else if (activeTab.type === 'library') {
          const libId = activeTab.data.id
          const targetUri = activeTab.data.serverUri || serverInfo.uri
          const targetToken = activeTab.data.token || serverInfo.token
          const allData = await getLibraryItems(targetUri, targetToken, libId)

          await preloadImages([allData])

          setLibraryContent({ all: allData })
        }
      } catch (error) {
        console.error('[fetchContent] Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [activeTab, serverInfo])

  // Global Input Locking & Mode Management
  useEffect(() => {
    const handleGlobalMouseMove = () => {
      if (navigationMode !== 'cursor') {
        setNavigationMode('cursor')
      }
    }

    const handleGlobalWheel = () => {
      // Wheel use should also lock out D-pad focus effects temporarily
      lastRemoteActionRef.current = Date.now()
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('wheel', handleGlobalWheel)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('wheel', handleGlobalWheel)
    }
  }, [])

  const handleItemClick = (item, isContinueWatching = false, uid) => {
    console.log('Selected item:', item, 'isContinueWatching:', isContinueWatching)
    const { path } = resolveMediaNavigation(item, isContinueWatching)

    let targetServerInfo = serverInfo
    if (item._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId]
      if (s) {
        targetServerInfo = { uri: s.uri, token: s.accessToken, owned: s.owned }
      }
    } else if (activeTab.type === 'library' && activeTab.data?.isShared) {
      targetServerInfo = { uri: activeTab.data.serverUri, token: activeTab.data.token, owned: false }
    }

    if (document.startViewTransition) {
      globalClickedItemId = uid
      setClickedItemId(uid)
      // Allow React to paint the view-transition-name on the clicked card first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.startViewTransition(() => {
            navigate(path, { state: { serverInfo: targetServerInfo, item } })
          })
        })
      })
    } else {
      navigate(path, { state: { serverInfo: targetServerInfo, item } })
    }
  }

  const handleToggleWatched = async (item) => {
    let targetServerInfo = serverInfo
    if (item._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId]
      if (s) {
        targetServerInfo = { uri: s.uri, token: s.accessToken, owned: s.owned }
      }
    } else if (activeTab.type === 'library' && activeTab.data?.isShared) {
      targetServerInfo = { uri: activeTab.data.serverUri, token: activeTab.data.token }
    }
    const newWatchedState = await toggleWatched(item, targetServerInfo)
    if (newWatchedState !== null) {
      const updateItem = (i) => {
        if (i.id === item.id) {
          if (newWatchedState) {
            return {
              ...i,
              viewCount: 1,
              viewedLeafCount: i.leafCount || 1,
              viewOffset: 0
            }
          } else {
            return {
              ...i,
              viewCount: 0,
              viewedLeafCount: 0,
              viewOffset: 0
            }
          }
        }
        return i
      }

      setContinueWatching((continueWatching || [])
        .map(updateItem)
        .filter(i => !(newWatchedState && i.id === item.id))
      )
      setRecentMovies((recentMovies || []).map(updateItem))
      setRecentTv((recentTv || []).map(updateItem))
      setLibraryContent({
        all: (libraryContent.all || []).map(updateItem)
      })

      // Fetch latest On Deck to populate the next episode or updated state
      try {
        const onDeckData = await multiServerCacheService.getOnDeck(true)
        // Preload only the new images to avoid pop-in
        const existingThumbs = new Set((continueWatching || []).map(i => i.thumb))
        const newUrls = onDeckData.map(i => i.thumb).filter(url => url && !existingThumbs.has(url))
        if (newUrls.length > 0) {
          await preloadImages([newUrls.map(thumb => ({ thumb }))])
        }
        
        // We must fetch latest state from store since this is an async function
        const latestContinueWatching = useBrowserStore.getState().continueWatching || []
        const onDeckMap = new Map(onDeckData.map(i => [i.id, i]))
        const prevIds = new Set(latestContinueWatching.map(i => i.id))
        
        // Keep existing items in their current order, but update them with fresh data if available
        const updatedPrev = latestContinueWatching.map(i => onDeckMap.has(i.id) ? onDeckMap.get(i.id) : i)
        
        // Append entirely new items (like next episodes) to the end
        const newItems = onDeckData.filter(i => !prevIds.has(i.id))
        
        setContinueWatching([...updatedPrev, ...newItems])
      } catch (err) {
        console.error('[handleToggleWatched] Failed to refresh On Deck items:', err)
      }
    }
  }

  const handleNavClick = (navItem) => {
    console.log('[NAV] Clicked:', navItem, 'Current active:', activeTab)
    if (activeTab.type === navItem.type) {
      if (navItem.type === 'library' && activeTab.data?.id === navItem.data?.id && activeTab.data?.serverClientId === navItem.data?.serverClientId) {
        console.log('[NAV] Ignored click on already active library tab')
        return; // Ignore clicks on the already active library tab
      }
      if (navItem.type === 'home' || navItem.type === 'settings') {
        console.log('[NAV] Ignored click on already active home/settings tab')
        return; // Ignore clicks on the already active home/settings tab
      }
    }
    console.log('[NAV] Setting active tab to:', navItem)
    setActiveTab(navItem)
  }

  const renderCard = (item, rowIndex, colIndex, prefix) => {
    let isUnwatched = false;

    // Never show the unwatched ribbon on items in the "Continue Watching" (cw) row,
    // or items that are partially watched (have a viewOffset).
    if (prefix !== 'cw') {
      isUnwatched = !isMediaWatched(item) && !item.viewOffset
    }

    const uid = `${prefix}-${item.id}`

    let thumbUrl = item.thumb
    if (item._serverContext?.clientId && item.rawThumb) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId]
      if (s && s.uri && s.accessToken) {
        thumbUrl = buildImageUrl(s.uri, item.rawThumb, s.accessToken, 400, 600)
      }
    }

    return (
      <FocusableItem
        key={`${prefix}-${item.id}-${colIndex}`}
        id={`poster-${prefix}-${item.id}`}
        rowIndex={rowIndex}
        colIndex={colIndex}
        onClick={() => handleItemClick(item, prefix === 'cw', uid)}
        style={{ flexShrink: 0 }}
      >
        <div 
          style={{
            ...styles.card,
            viewTransitionName: clickedItemId === uid ? 'active-poster' : 'none'
          }}
        >
          <FallbackImage
            src={thumbUrl}
            itemId={item.id}
            alt={item.grandparentTitle || item.title}
            style={styles.poster}
            loading="lazy"
            decoding="async"
          />
          {showUnwatchedIndicator && (
            (prefix === 'cw' || isUnwatched) ? (
              <div
                style={prefix === 'cw' ? styles.unwatchedEpisodeRibbonBottomLeft : styles.unwatchedEpisodeRibbon}
                className={`unwatched-episode-ribbon ${prefix === 'cw' ? 'ribbon-bottom-left' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleWatched(item)
                }}
              >
                {/* Tick checkmark (Shown on hover/cursor) */}
                <svg className="unwatched-tick" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-45deg)', marginBottom: prefix === 'cw' ? '0' : '6px', marginTop: prefix === 'cw' ? '14px' : '0' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            ) : (
              <div
                style={styles.watchedRibbon}
                className="watched-ribbon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleWatched(item)
                }}
              >
                {/* Tick checkmark (Shown by default) */}
                <svg className="watched-tick" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {/* Cross X (Shown on hover) */}
                <svg className="watched-cross" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none', transform: 'rotate(-45deg)', marginBottom: '6px' }}>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
            )
          )}
          {!!item.viewOffset && item.duration && (
            <div style={styles.progressBarContainer}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${(item.viewOffset / item.duration) * 100}%`
                }}
              />
            </div>
          )}
        </div>
      </FocusableItem>
    )
  }

  return (
    <div style={styles.container}>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .setting-toggle {
          cursor: pointer;
          border-radius: 9999px;
        }
        .setting-toggle.focused > div {
          background-color: rgba(255, 255, 255, 0.25) !important;
          color: #fff !important;
          box-shadow: inset 0 0 10px rgba(255,255,255,0.2) !important;
        }
        .setting-toggle.focused > .signout-red {
          background-color: rgba(217, 56, 56, 0.6) !important;
          color: #fff !important;
          box-shadow: 0 0 20px rgba(217, 56, 56, 0.6) !important;
        }
        .setting-toggle[style] {
          transform: scale(1) !important;
        }
        .watched-ribbon {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
        }
        .watched-ribbon:hover {
          background-color: rgba(255, 115, 0, 0.8) !important;
          border-color: rgba(255, 115, 0, 0.95) !important;
          cursor: pointer;
          transform: rotate(45deg) scale(1.05) !important;
        }
        .watched-ribbon:hover .watched-tick {
          display: none !important;
        }
        .watched-ribbon:hover .watched-cross {
          display: block !important;
        }
        .unwatched-episode-ribbon {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
        }
        .unwatched-episode-ribbon:hover {
          background-color: rgba(140, 140, 140, 0.75) !important;
          border-color: rgba(255, 255, 255, 0.9) !important;
          cursor: pointer;
          transform: rotate(45deg) scale(1.05) !important;
        }
        .unwatched-episode-ribbon .unwatched-tick {
          display: none !important;
        }
        .unwatched-episode-ribbon:hover .unwatched-tick {
          display: block !important;
        }



        .card-rewind-button {
          position: absolute;
          bottom: 16px;
          left: 68px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background-color: rgba(0, 0, 0, 0.65);
          border: 1.5px solid rgba(255, 255, 255, 0.35);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(10px) scale(0.9);
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease;
          z-index: 6;
        }
        .card-rewind-button:hover {
          background-color: rgba(255, 255, 255, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.95) !important;
        }
        .card-rewind-button:hover svg {
          stroke: #000000 !important;
        }
        .focusable-item.focused .card-rewind-button {
          opacity: 1 !important;
          transform: translateY(0) scale(1) !important;
        }

        /* Apple TV Settings Styles */
        .settings-rows-container {
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding: 20px 0;
          margin: 0;
          width: 100%;
        }
        .settings-rows-container h2 {
          margin-left: calc(12vh - 30px) !important;
        }
        .settings-rows-container .row-items {
          margin: -10px -30px 0 -30px !important;
          padding: 30px 12vh !important;
          scroll-padding-left: 12vh !important;
          scroll-padding-right: 12vh !important;
        }
        .setting-card {
          width: 260px;
          height: 260px;
          border-radius: 18px;
          background-color: rgba(255, 255, 255, 0.08);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 20px;
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease !important;
          cursor: pointer;
          will-change: transform;
          transform: translate3d(0, 0, 0);
        }
        .setting-card[style] {
          transform: scale(1) translate3d(0, 0, 0) !important;
        }
        .setting-card.focused {
          transform: scale(1.08) translate3d(0, 0, 0) !important;
          background-color: rgba(255, 255, 255, 0.2) !important;
          border-color: #ffffff !important;
        }
        .setting-card.active-profile-fused {
          border: 2px solid rgba(255, 255, 255, 0.25);
          background-color: rgba(255, 255, 255, 0.05);
        }
        .setting-card.active-profile-fused.focused {
          border-color: #ffffff !important;
          background-color: rgba(255, 255, 255, 0.16) !important;
        }
        .setting-card.major {
          border: 1.5px solid rgba(10, 132, 255, 0.3) !important;
          background-color: rgba(10, 132, 255, 0.08) !important;
        }
        .setting-card.major.focused {
          background-color: rgba(10, 132, 255, 0.85) !important;
          border-color: #0a84ff !important;
        }
        .setting-card.major.focused .setting-card-title,
        .setting-card.major.focused .setting-card-subtext,
        .setting-card.major.focused svg {
          color: #ffffff !important;
          stroke: #ffffff !important;
          opacity: 1 !important;
        }
        .setting-card-title {
          font-size: 26px;
          font-weight: 600;
          color: #a8a8af;
          margin-top: 15px;
          font-family: 'Outfit', 'Inter', sans-serif;
          transition: color 0.1s ease;
        }
        .setting-card.focused .setting-card-title {
          color: #ffffff;
        }
        .setting-card-value {
          font-size: 30px;
          font-weight: 800;
          margin-top: 5px;
          font-family: 'Outfit', 'Inter', sans-serif;
          transition: color 0.1s ease;
        }
        .setting-card-subtext {
          font-size: 20px;
          color: #888;
          margin-top: 8px;
          word-break: break-all;
          max-width: 100%;
          line-height: 1.3;
        }
        .numpad-btn {
          border-radius: 50% !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .numpad-btn[style] {
          transform: scale(1) !important;
        }
        .numpad-btn.focused {
          transform: scale(1.15) !important;
        }
        .numpad-btn.focused div {
          background-color: #ffffff !important;
          border-color: #ffffff !important;
          color: #0d0f11 !important;
        }
        .cancel-btn {
          border-radius: 50px !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .cancel-btn[style] {
          transform: scale(1) !important;
        }
        .cancel-btn.focused {
          transform: scale(1.08) !important;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.15) !important;
        }
        .cancel-btn.focused div {
          background-color: rgba(255, 255, 255, 0.2) !important;
          border-color: rgba(255, 255, 255, 0.4) !important;
          color: #ffffff !important;
        }
      `}</style>

      <NavigationBar
        libraries={libraries}
        activeTab={activeTab}
        onItemClick={handleNavClick}
      />

      {loading ? (
        <div style={styles.emptyContainer}>
          <div style={styles.loadingText}></div>
        </div>
      ) : (
        <>
          {activeTab.type === 'home' && (
            <>
              {continueWatching.length === 0 && recentMovies.length === 0 && recentTv.length === 0 ? (
                <div style={styles.emptyContainer}>
                  <div style={styles.emptyText}>No items found</div>
                </div>
              ) : (
                <>
                  {continueWatching.length > 0 && (
                    <div style={styles.section} className="row">
                      <h2 style={styles.sectionTitle}>Continue Watching</h2>
                      <div style={styles.row} className="hide-scrollbar row-items">
                        {continueWatching.map((item, index) => renderCard(item, 0, index, 'cw'))}
                      </div>
                    </div>
                  )}

                  {recentMovies.length > 0 && (
                    <div style={styles.section} className="row">
                      <h2 style={styles.sectionTitle}>Recently Added Movies</h2>
                      <div style={styles.row} className="hide-scrollbar row-items">
                        {recentMovies.map((item, index) => renderCard(item, 1, index, 'rm'))}
                      </div>
                    </div>
                  )}

                  {recentTv.length > 0 && (
                    <div style={styles.section} className="row">
                      <h2 style={styles.sectionTitle}>Recently Added TV Shows</h2>
                      <div style={styles.row} className="hide-scrollbar row-items">
                        {recentTv.map((item, index) => renderCard(item, 2, index, 'rt'))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab.type === 'library' && (
            <>
              {libraryContent.all.length === 0 ? (
                <div style={styles.emptyContainer}>
                  <div style={styles.emptyText}>No items found in this library</div>
                </div>
              ) : (
                <>
                  {libraryContent.all.length > 0 && (
                    <div style={styles.section} className="row">
                      <div style={styles.grid}>
                        {libraryContent.all.map((item, index) => {
                          const rowIndex = Math.floor(index / ITEMS_PER_ROW) + 1
                          const colIndex = index % ITEMS_PER_ROW
                          return renderCard(item, rowIndex, colIndex, 'lib-all')
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab.type === 'settings' && (
            <div className="settings-rows-container">
              {/* Row 10: Profiles */}
              <div style={styles.section} className="row">
                <h2 style={styles.sectionTitle}>Profiles</h2>
                <div style={styles.row} className="hide-scrollbar row-items">
                  {/* Current profile static card */}
                  {/* Fused Active Profile + Remember PIN card */}
                  <FocusableItem
                    id="setting-active-profile-fused"
                    rowIndex={10}
                    colIndex={0}
                    onClick={handleToggleRememberPin}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card active-profile-fused" style={{
                      width: '460px',
                      flexDirection: 'row',
                      padding: '24px',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '24px'
                    }}>
                      {currentProfile && (
                        <>
                          {/* Left Profile Info Section */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '10px' }}>
                            <img
                              src={usersList.find(u => u.id === currentProfile.userId)?.avatar || ''}
                              alt={currentProfile.userName}
                              style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #ffffff' }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                              {currentProfile.userName}
                            </div>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '700',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              color: '#ffffff',
                              padding: '4px 14px',
                              borderRadius: '8px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Active
                            </div>
                          </div>

                          {/* Vertical Divider Inside Fused Card */}
                          <div style={{ width: '1.5px', height: '120px', backgroundColor: 'rgba(255, 255, 255, 0.15)', flexShrink: 0 }} />

                          {/* Right Toggler Section */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: currentProfile?.rememberPin !== false ? '#ffffff' : 'rgba(255, 255, 255, 0.4)' }}>
                              {currentProfile?.rememberPin !== false ? (
                                <>
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </>
                              ) : (
                                <>
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                  <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" />
                                </>
                              )}
                            </svg>
                            <div style={{ fontSize: '22px', fontWeight: '600', color: '#a8a8af', textAlign: 'center', lineHeight: '1.2' }}>
                              {currentProfile?.isProtected ? 'Remember PIN' : 'Auto-Login'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </FocusableItem>

                  <FocusableItem
                    id="setting-switch-profile"
                    rowIndex={10}
                    colIndex={1}
                    onClick={handleSwitchProfileClick}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <div className="setting-card-title">Switch Profile</div>
                      <div className="setting-card-subtext" style={{ marginTop: '10px' }}>
                        Go to profile selection
                      </div>
                    </div>
                  </FocusableItem>
                </div>
              </div>

              {/* Row 11: Preferences */}
              <div style={styles.section} className="row">
                <h2 style={styles.sectionTitle}>Preferences</h2>
                <div style={styles.row} className="hide-scrollbar row-items">
                  <FocusableItem
                    id="setting-toggle-unwatched"
                    rowIndex={11}
                    colIndex={0}
                    onClick={() => {
                      const newValue = !showUnwatchedIndicator
                      setShowUnwatchedIndicator(newValue)
                      setData(DB_KINDS.PREFERENCES, KINDS.preferences, {
                        showUnwatchedIndicator: newValue,
                        subtitleWeight,
                        subtitleColor,
                        subtitleSize,
                        showSubtitleHUDControls
                      })
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: showUnwatchedIndicator ? '#ffffff' : 'rgba(255, 255, 255, 0.4)' }}>
                        {showUnwatchedIndicator ? (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        ) : (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" />
                          </>
                        )}
                      </svg>
                      <div className="setting-card-title">Unwatched Ribbon</div>
                    </div>
                  </FocusableItem>

                  {/* Subtitle Weight Setting */}
                  <FocusableItem
                    id="setting-subtitle-weight"
                    rowIndex={11}
                    colIndex={1}
                    onClick={() => {
                      const weights = [400, 700, 900]
                      const currentIndex = weights.indexOf(subtitleWeight || 400)
                      const nextIndex = (currentIndex + 1) % weights.length
                      const newWeight = weights[nextIndex]
                      setSubtitleWeight(newWeight)
                      setData(DB_KINDS.PREFERENCES, KINDS.preferences, {
                        showUnwatchedIndicator,
                        subtitleWeight: newWeight,
                        subtitleColor,
                        subtitleSize,
                        showSubtitleHUDControls
                      })
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>W</div>
                      <div className="setting-card-title">Subtitle Weight: {subtitleWeight === 400 ? 'Normal' : subtitleWeight === 700 ? 'Bold' : 'Heavy'}</div>
                    </div>
                  </FocusableItem>

                  {/* Subtitle Color Setting */}
                  <FocusableItem
                    id="setting-subtitle-color"
                    rowIndex={11}
                    colIndex={2}
                    onClick={() => {
                      const colors = ['#FFFFFF', '#737373', '#4A4A4A', '#222222']
                      const currentIndex = colors.indexOf(subtitleColor || '#FFFFFF')
                      const nextIndex = (currentIndex + 1) % colors.length
                      const newColor = colors[nextIndex]
                      setSubtitleColor(newColor)
                      setData(DB_KINDS.PREFERENCES, KINDS.preferences, {
                        showUnwatchedIndicator,
                        subtitleWeight,
                        subtitleColor: newColor,
                        subtitleSize,
                        showSubtitleHUDControls
                      })
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: subtitleColor || '#FFFFFF', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                      <div className="setting-card-title">Color: {subtitleColor === '#FFFFFF' ? 'White' : subtitleColor === '#737373' ? 'Grey' : subtitleColor === '#4A4A4A' ? 'Dark Grey' : 'Extra Dark'}</div>
                    </div>
                  </FocusableItem>

                  {/* Subtitle Size Setting */}
                  <FocusableItem
                    id="setting-subtitle-size"
                    rowIndex={11}
                    colIndex={3}
                    onClick={() => {
                      const sizes = ['1.5rem', '2.5rem', '3.5rem']
                      const currentIndex = sizes.indexOf(subtitleSize || '2.5rem')
                      const nextIndex = (currentIndex + 1) % sizes.length
                      const newSize = sizes[nextIndex]
                      setSubtitleSize(newSize)
                      setData(DB_KINDS.PREFERENCES, KINDS.preferences, {
                        showUnwatchedIndicator,
                        subtitleWeight,
                        subtitleColor,
                        subtitleSize: newSize,
                        showSubtitleHUDControls
                      })
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>Aa</div>
                      <div className="setting-card-title">Size: {subtitleSize === '1.5rem' ? 'Small' : subtitleSize === '2.5rem' ? 'Medium' : 'Large'}</div>
                    </div>
                  </FocusableItem>

                  {/* Player HUD Controls Setting */}
                  <FocusableItem
                    id="setting-subtitle-hud"
                    rowIndex={11}
                    colIndex={4}
                    onClick={() => {
                      const newValue = !showSubtitleHUDControls
                      setShowSubtitleHUDControls(newValue)
                      setData(DB_KINDS.PREFERENCES, KINDS.preferences, {
                        showUnwatchedIndicator,
                        subtitleWeight,
                        subtitleColor,
                        subtitleSize,
                        showSubtitleHUDControls: newValue
                      })
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: showSubtitleHUDControls ? '#ffffff' : 'rgba(255, 255, 255, 0.4)' }}>HUD</div>
                      <div className="setting-card-title">Player Toggles: {showSubtitleHUDControls ? 'On' : 'Off'}</div>
                    </div>
                  </FocusableItem>

                  {/* Manage Libraries Setting */}
                  <FocusableItem
                    id="setting-manage-libraries"
                    rowIndex={11}
                    colIndex={5}
                    onClick={() => {
                      navigate('/library-select', {
                        state: {
                          isShared: false,
                          from: 'settings'
                        }
                      })
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffffff' }}>
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                      <div className="setting-card-title">Manage Libraries</div>
                    </div>
                  </FocusableItem>
                </div>
              </div>

              {/* Row 12: Shared Servers */}
              {sharedServers.length > 0 && (
                <div style={styles.section} className="row">
                  <h2 style={styles.sectionTitle}>Shared Servers</h2>
                  <div style={styles.row} className="hide-scrollbar row-items">
                    {sharedServers.map((server, colIdx) => {
                      const selectedIds = useAppStore.getState().selectedLibrariesByServer[server.clientIdentifier] || []
                      const hasSelectedLibs = selectedIds.length > 0
                      
                      return (
                        <FocusableItem
                          key={`setting-shared-server-${server.clientIdentifier}`}
                          id={`setting-shared-server-${server.clientIdentifier}`}
                          rowIndex={12}
                          colIndex={colIdx}
                          onClick={() => {
                            navigate('/library-select', {
                              state: {
                                isShared: true,
                                serverClientId: server.clientIdentifier,
                                from: 'settings'
                              }
                            })
                          }}
                          style={{ flexShrink: 0 }}
                        >
                          <div className="setting-card" style={{ position: 'relative' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffffff' }}>
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                              <line x1="8" y1="21" x2="16" y2="21"></line>
                              <line x1="12" y1="17" x2="12" y2="21"></line>
                            </svg>
                            <div className="setting-card-title">{server.name}</div>
                            <div className="setting-card-subtext" style={{ marginTop: '10px' }}>
                              {hasSelectedLibs ? `${selectedIds.length} libraries pinned` : 'None pinned'}
                            </div>

                            {hasSelectedLibs && (
                              <div 
                                style={{
                                  position: 'absolute',
                                  top: '16px',
                                  right: '16px',
                                  backgroundColor: '#34a853',
                                  borderRadius: '50%',
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  border: '2px solid #ffffff',
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                  zIndex: 10
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    await useAppStore.getState().setSelectedLibrariesForServer(server.clientIdentifier, [])
                                    await loadAllSelectedLibraries()
                                  } catch (err) {
                                    console.error('Failed to clear library selections:', err)
                                  }
                                }}
                                title="Click to deselect all libraries"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              </div>
                            )}
                          </div>
                        </FocusableItem>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Row 13: System */}
              <div style={styles.section} className="row">
                <h2 style={styles.sectionTitle}>System</h2>
                <div style={styles.row} className="hide-scrollbar row-items">

                  <FocusableItem
                    id="setting-sign-out"
                    rowIndex={sharedServers.length > 0 ? 13 : 12}
                    colIndex={0}
                    onClick={() => setShowSignoutConfirm(true)}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="setting-card">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <div className="setting-card-title">Sign Out</div>
                      <div className="setting-card-subtext" style={{ marginTop: '10px' }}>
                        Back to login screen
                      </div>
                    </div>
                  </FocusableItem>

                  {/* Sign-out Confirmation Dialog */}
                  {showSignoutConfirm && (
                    <div style={{ ...styles.exitOverlay, alignItems: 'flex-end' }} className="exit-overlay">
                      <div style={styles.exitModal} className="exit-modal">
                        <span style={styles.exitTitle}>Sign out of Plex?</span>
                        <div style={styles.exitButtonRow}>
                          <FocusableItem
                            id="signout-cancel"
                            rowIndex={999}
                            colIndex={0}
                            onClick={() => setShowSignoutConfirm(false)}
                            className="exit-btn cancel"
                          >
                            No
                          </FocusableItem>
                          <FocusableItem
                            id="signout-confirm"
                            rowIndex={999}
                            colIndex={1}
                            onClick={async () => {
                              try {
                                await useAppStore.getState().signOut()
                                navigate('/login')
                              } catch (err) {
                                console.error('Failed to sign out:', err)
                              }
                            }}
                            className="exit-btn danger"
                          >
                            Yes
                          </FocusableItem>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PIN Dialog Overlay */}
              {pinDialogUser && (
                <div style={styles.exitOverlay} className="exit-overlay">
                  <div style={styles.pinCardSettings}>
                    <div style={styles.pinAvatarWrapper}>
                      <img
                        src={pinDialogUser.avatar}
                        alt={pinDialogUser.name}
                        style={styles.pinAvatar}
                      />
                      <div style={styles.pinLockBadge}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" style={{ display: 'block' }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                    </div>
                    <h2 style={styles.pinTitle}>Enter PIN for {pinDialogUser.name}</h2>

                    <div style={styles.pinDisplay}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={enteredPin.length > i ? styles.pinDotFilled : styles.pinDotEmpty}>
                          {enteredPin.length > i && <span style={styles.pinDotInner}></span>}
                        </div>
                      ))}
                    </div>

                    <div style={styles.pinErrorContainer}>
                      {pinError && <p style={styles.pinError}>{pinError}</p>}
                    </div>

                    <div style={styles.numpad}>
                      {[1, 2, 3].map((num, index) => (
                        <FocusableItem
                          key={num}
                          id={`settings-numpad-${num}`}
                          rowIndex={20}
                          colIndex={index}
                          onClick={() => {
                            if (enteredPin.length < 4) {
                              const newPin = enteredPin + num
                              setEnteredPin(newPin)
                              if (newPin.length === 4) {
                                setTimeout(() => handlePinSubmit(newPin), 200)
                              }
                            }
                          }}
                          className="numpad-btn"
                        >
                          <div style={styles.numButton}>{num}</div>
                        </FocusableItem>
                      ))}

                      {[4, 5, 6].map((num, index) => (
                        <FocusableItem
                          key={num}
                          id={`settings-numpad-${num}`}
                          rowIndex={21}
                          colIndex={index}
                          onClick={() => {
                            if (enteredPin.length < 4) {
                              const newPin = enteredPin + num
                              setEnteredPin(newPin)
                              if (newPin.length === 4) {
                                setTimeout(() => handlePinSubmit(newPin), 200)
                              }
                            }
                          }}
                          className="numpad-btn"
                        >
                          <div style={styles.numButton}>{num}</div>
                        </FocusableItem>
                      ))}

                      {[7, 8, 9].map((num, index) => (
                        <FocusableItem
                          key={num}
                          id={`settings-numpad-${num}`}
                          rowIndex={22}
                          colIndex={index}
                          onClick={() => {
                            if (enteredPin.length < 4) {
                              const newPin = enteredPin + num
                              setEnteredPin(newPin)
                              if (newPin.length === 4) {
                                setTimeout(() => handlePinSubmit(newPin), 200)
                              }
                            }
                          }}
                          className="numpad-btn"
                        >
                          <div style={styles.numButton}>{num}</div>
                        </FocusableItem>
                      ))}

                      <div></div>
                      <FocusableItem
                        id="settings-numpad-0"
                        rowIndex={23}
                        colIndex={1}
                        onClick={() => {
                          if (enteredPin.length < 4) {
                            const newPin = enteredPin + 0
                            setEnteredPin(newPin)
                            if (newPin.length === 4) {
                              setTimeout(() => handlePinSubmit(newPin), 200)
                            }
                          }
                        }}
                        className="numpad-btn"
                      >
                        <div style={styles.numButton}>0</div>
                      </FocusableItem>
                      <div></div>
                    </div>

                    <div style={styles.cancelRow}>
                      <FocusableItem
                        id="settings-cancel-btn"
                        rowIndex={24}
                        colIndex={1}
                        onClick={() => setPinDialogUser(null)}
                        className="cancel-btn"
                      >
                        <div style={styles.cancelButton}>Cancel</div>
                      </FocusableItem>
                    </div>
                  </div>
                </div>
              )}


            </div>
          )}
        </>
      )}
    </div>
  )
}

const APP_BASE_COLOR = '#ffffff'


const styles = {
  container: {
    minHeight: '100vh',
    color: '#e8eaed',
    padding: '40px 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    overflowX: 'hidden',
  },
  settingsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    padding: '20px 0',
    width: '100%',
  },
  settingsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: '30px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  settingsSubTitle: {
    fontSize: '34px',
    color: '#e5a00d',
    margin: 0,
    fontWeight: '600',
    letterSpacing: '1px',
  },
  settingItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  settingLabel: {
    fontSize: '28px',
    color: '#e8eaed',
  },
  toggleCapsule: {
    backgroundColor: 'rgba(25, 25, 30, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '9999px',
    padding: '16px 40px',
    fontSize: '26px',
    fontWeight: '600',
    minWidth: '180px',
    textAlign: 'center',
    transition: 'background-color 0.1s ease, color 0.1s ease',
  },
  signoutButtonContent: {
    backgroundColor: 'rgba(217, 56, 56, 0.4)',
    border: '1px solid rgba(217, 56, 56, 0.45)',
    borderRadius: '9999px',
    padding: '16px 40px',
    fontSize: '26px',
    fontWeight: '700',
    minWidth: '180px',
    textAlign: 'center',
    transition: 'background-color 0.1s ease, color 0.1s ease',
    color: '#ff6666',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    height: '100vh',
    width: '100%',
    zIndex: 900
  },
  emptyContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '100px 0',
  },
  loadingText: {
    fontSize: '3rem',
    color: APP_BASE_COLOR,
  },
  emptyText: {
    fontSize: '36px',
    color: '#666',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '10px',
  },
  sectionTitle: {
    fontSize: '34px',
    color: '#a8a8af',
    margin: 0,
    fontWeight: '500',
    fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
    letterSpacing: '-0.3px',
  },
  row: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: '45px',
    overflowX: 'auto',
    padding: '30px 45px', // Expand horizontal padding for focus zoom room
    margin: '-10px -45px 0 -45px', // Expand negative margins to screen edges to prevent early clipping
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    scrollSnapType: 'x mandatory',
    scrollBehavior: 'smooth',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 240px)', // Beautiful centered 6 columns
    justifyContent: 'center',
    gap: '45px',
    padding: '20px 0',
  },
  card: {
    position: 'relative',
    cursor: 'pointer',
    borderRadius: '12px',
    overflow: 'hidden',
    flexShrink: 0,
    scrollSnapAlign: 'start end',
    scrollMarginLeft: '45px',
    scrollMarginRight: '120px',
  },
  poster: {
    width: '240px',
    height: '360px',
    objectFit: 'cover',
    borderRadius: '12px',
    background: '#222',
    display: 'block',
    transition: 'border-color 0.15s ease',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    height: '6px',
    background: 'rgba(255, 255, 255, 0.3)',
    borderBottomLeftRadius: '12px',
    borderBottomRightRadius: '12px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    background: '#e5a00d',
  },
  watchedRibbon: {
    position: 'absolute',
    top: '-70px',
    right: '-70px',
    width: '140px',
    height: '140px',
    backgroundColor: 'rgba(229, 160, 13, 0.75)', // Elegant Plex Gold translucent glass (0.75 opacity)
    border: '1px solid rgba(255, 255, 255, 0.15)',
    transform: 'rotate(45deg)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  unwatchedEpisodeRibbon: {
    position: 'absolute',
    top: '-70px',
    right: '-70px',
    width: '140px',
    height: '140px',
    backgroundColor: 'rgba(90, 90, 90, 0.75)', // Matte slate grey translucent glass (0.75 opacity)
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transform: 'rotate(45deg)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  unwatchedEpisodeRibbonBottomLeft: {
    position: 'absolute',
    bottom: '-70px',
    left: '-70px',
    width: '140px',
    height: '140px',
    backgroundColor: 'rgba(90, 90, 90, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transform: 'rotate(45deg)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '16px',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.4)',
  },
  exitOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // Premium dark backdrop overlay
    zIndex: 999999,
    display: 'flex',
    alignItems: 'center', // Centered vertically for PIN dialog!
    justifyContent: 'center', // Centers modal perfectly both horizontally and vertically
  },
  pinCardSettings: {
    padding: '40px 50px 30px',
    background: 'rgba(20, 20, 26, 0.98)',
    border: '1.5px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '32px',
    textAlign: 'center',
    width: '650px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: 'auto',
  },
  pinAvatarWrapper: {
    position: 'relative',
    marginBottom: '20px',
  },
  pinAvatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '3px solid #ffffff',
    objectFit: 'cover'
  },
  pinLockBadge: {
    position: 'absolute',
    bottom: '0',
    right: '0',
    background: '#1d2024',
    borderRadius: '50%',
    width: '38px',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #ffffff'
  },
  pinTitle: {
    fontSize: '32px',
    color: '#ffffff',
    marginBottom: '20px',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontWeight: '700'
  },
  pinDisplay: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    marginBottom: '15px'
  },
  pinDotEmpty: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2.5px solid rgba(255, 255, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  pinDotFilled: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2.5px solid #ffffff',
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 15px rgba(255, 255, 255, 0.55)',
    transition: 'all 0.15s ease'
  },
  pinDotInner: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#ffffff'
  },
  pinErrorContainer: {
    minHeight: '36px',
    marginBottom: '15px'
  },
  pinError: {
    fontSize: '24px',
    color: '#ea4335',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontWeight: '600'
  },
  numpad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    width: '380px',
    margin: '0 auto 25px'
  },
  numButton: {
    fontSize: '32px',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  cancelRow: {
    display: 'flex',
    justifyContent: 'center'
  },
  cancelButton: {
    fontSize: '24px',
    padding: '12px 60px',
    background: 'transparent',
    color: '#9aa0a6',
    border: '2px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '50px',
    cursor: 'pointer',
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: 'all 0.2s ease'
  },
  exitModal: {
    backgroundColor: 'rgba(20, 20, 26, 0.95)', // Premium dark glassmorphism
    border: '1.5px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '9999px', // Perfect horizontal capsule pill matching the Navbar!
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
    padding: '0 45px',
    display: 'flex',
    flexDirection: 'row', // Horizontal one-liner layout!
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '60px',
    height: '100px', // Enlarged slightly to look gorgeous on high-res TVs
    width: 'auto',
    minWidth: '820px', // Spacious breathing room for larger text
    marginBottom: '25vh', // Raised beautifully by a quarter of screen height!
  },
  exitTitle: {
    fontSize: '32px', // Larger, highly legible text for large TV layouts!
    fontWeight: '600',
    color: '#ffffff',
    margin: 0,
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-0.3px',
  },
  exitButtonRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '20px',
  }
}

export default ContentBrowserPage
