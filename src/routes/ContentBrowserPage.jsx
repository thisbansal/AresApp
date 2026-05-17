import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { NavigationBar } from '../components/navigational/NavigationBar'
import { FallbackImage } from '../components/media/FallbackImage'
import { getMainToken } from '../services/luna/tokenStorage'
import { DB_KINDS, getData, setData } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { getServers, getBestServerConnection, testConnectionToServer } from '../services/plex/plexAPIServer'
import { getOnDeck, getRecentlyAdded, getLibraries, getLibraryItems, markAsWatched, markAsUnwatched } from '../services/plex/plexContentService'
import { useNotificationStore } from '../services/notifications/notificationStore'
import { useBrowserStore } from '../stores/browserStore'
import { useFocusStore } from '../stores/FocusStore'

function ContentBrowserPage() {
  const navigate = useNavigate()

  // State
  const [serverInfo, setServerInfo] = useState(null)
  const [libraries, setLibraries] = useState([])
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
  const showNotifications = useBrowserStore((state) => state.showNotifications)
  const setShowNotifications = useBrowserStore((state) => state.setShowNotifications)
  const showUnwatchedIndicator = useBrowserStore((state) => state.showUnwatchedIndicator)
  const setShowUnwatchedIndicator = useBrowserStore((state) => state.setShowUnwatchedIndicator)

  const [loading, setLoading] = useState(true)

  const ITEMS_PER_ROW = 6

  // 1. Initialise Server Info and Libraries
  useEffect(() => {
    const initServerAndNav = async () => {
      try {
        const token = await getMainToken()
        if (!token) return

        // Load Settings
        let prefs = await getData(DB_KINDS.PREFERENCES, KINDS.preferences)
        if (prefs) {
          if (prefs.showUnwatchedIndicator !== undefined) setShowUnwatchedIndicator(prefs.showUnwatchedIndicator)
          if (prefs.showNotifications !== undefined) setShowNotifications(prefs.showNotifications)
        }

        // 1. Fast Path: Try to boot instantly using the last known server address
        let currentUri = await getData(DB_KINDS.SERVER, KINDS.server)
        let isCurrentHealthy = false

        if (currentUri) {
          console.log('[init] Trying fast path:', currentUri)
          setServerInfo({ uri: currentUri, token })

          // Test health quickly (1500ms timeout)
          const startTime = Date.now()
          const healthy = await testConnectionToServer(currentUri, token, 1500)
          const duration = Date.now() - startTime

          if (healthy) {
            console.log(`[init] Fast path healthy (${duration}ms). Loading libraries...`)
            isCurrentHealthy = true
            getLibraries(currentUri, token).then(setLibraries).catch(e => console.warn('Fast path getLibraries failed:', e))

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
        console.log('[init] Running full server discovery...')
        const servers = await getServers(token)
        if (!servers || servers.length === 0) {
          if (!isCurrentHealthy) useNotificationStore.getState().addNotification('No Plex servers found.', { level: 'error' })
          return
        }

        const server = servers[0]
        const bestUri = await getBestServerConnection(server, token)

        if (bestUri && bestUri !== currentUri) {
          console.log('[init] Found better connection:', bestUri)
          await setData(DB_KINDS.SERVER, KINDS.server, bestUri)
          setServerInfo({ uri: bestUri, token })
          getLibraries(bestUri, token).then(setLibraries).catch(e => console.warn('Background getLibraries failed:', e))
        }
      } catch (error) {
        console.error('[initServerAndNav] Error:', error)
      }
    }
    initServerAndNav()
  }, [])

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
          useNotificationStore.getState().addNotification(`Image Load Failed: ${url}`, { level: 'dev' })
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
          const [onDeckData, recentData] = await Promise.all([
            getOnDeck(serverInfo.uri, serverInfo.token, 20),
            getRecentlyAdded(serverInfo.uri, serverInfo.token, null, 40) // Fetch more to ensure we have enough for both rows
          ])

          await preloadImages([onDeckData, recentData])

          setContinueWatching(onDeckData)
          setRecentMovies(recentData.filter(i => i.type === 'movie'))
          setRecentTv(recentData.filter(i => ['show', 'season', 'episode'].includes(i.type)))
        } else if (activeTab.type === 'library') {
          const libId = activeTab.data.id
          const allData = await getLibraryItems(serverInfo.uri, serverInfo.token, libId)

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
      const { navigationMode } = useFocusStore.getState()
      if (navigationMode !== 'cursor') {
        useFocusStore.setState({ navigationMode: 'cursor' })
      }
    }

    const handleGlobalWheel = () => {
      // Wheel use should also lock out D-pad focus effects temporarily
      useFocusStore.setState({ lastRemoteAction: Date.now() })
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('wheel', handleGlobalWheel)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('wheel', handleGlobalWheel)
    }
  }, [])

  const handleItemClick = (item) => {
    console.log('Selected item:', item)
    navigate(`/details/${item.id}`, { state: { serverInfo } })
  }

  const handleToggleWatched = async (item) => {
    try {
      if (!serverInfo?.uri || !serverInfo?.token) return

      let isCurrentlyWatched = false
      if (item.type === 'show' || item.type === 'season') {
        isCurrentlyWatched = item.leafCount
          ? ((item.viewedLeafCount || 0) === item.leafCount)
          : (Number(item.viewCount || 0) > 0 || Number(item.viewedLeafCount || 0) > 0)
      } else {
        isCurrentlyWatched = Number(item.viewCount || 0) > 0
      }

      if (isCurrentlyWatched) {
        // Mark as Unwatched
        await markAsUnwatched(serverInfo.uri, serverInfo.token, item.id)

        // Helper to update local store items
        const updateItem = (i) => {
          if (i.id === item.id) {
            return {
              ...i,
              viewCount: 0,
              viewedLeafCount: 0,
              viewOffset: 0
            }
          }
          return i
        }

        setContinueWatching((continueWatching || []).map(updateItem))
        setRecentMovies((recentMovies || []).map(updateItem))
        setRecentTv((recentTv || []).map(updateItem))
        setLibraryContent({
          all: (libraryContent.all || []).map(updateItem)
        })

        useNotificationStore.getState().addNotification(`Marked as unwatched: ${item.title}`, { level: 'success' })
      } else {
        // Mark as Watched
        await markAsWatched(serverInfo.uri, serverInfo.token, item.id)

        // Helper to update local store items
        const updateItem = (i) => {
          if (i.id === item.id) {
            return {
              ...i,
              viewCount: 1,
              viewedLeafCount: i.leafCount || 1,
              viewOffset: 0
            }
          }
          return i
        }

        setContinueWatching((continueWatching || []).map(updateItem))
        setRecentMovies((recentMovies || []).map(updateItem))
        setRecentTv((recentTv || []).map(updateItem))
        setLibraryContent({
          all: (libraryContent.all || []).map(updateItem)
        })

        useNotificationStore.getState().addNotification(`Marked as watched: ${item.title}`, { level: 'success' })
      }
    } catch (err) {
      console.error('Failed to toggle watched state:', err)
    }
  }

  const handleNavClick = (navItem) => {
    setActiveTab(navItem)
  }

  const renderCard = (item, rowIndex, colIndex, prefix) => {
    let isUnwatched = false;

    // Never show the unwatched ribbon on items in the "Continue Watching" (cw) row,
    // or items that are partially watched (have a viewOffset).
    if (prefix !== 'cw') {
      if (item.type === 'show' || item.type === 'season') {
        // Use leafCount if available, otherwise fallback to checking if any views exist
        isUnwatched = item.leafCount
          ? ((item.viewedLeafCount || 0) < item.leafCount)
          : (!item.viewCount && !item.viewedLeafCount)
      } else {
        isUnwatched = !item.viewCount && !item.viewOffset
      }
    }

    return (
      <FocusableItem
        key={`${prefix}-${item.id}-${colIndex}`}
        id={`poster-${prefix}-${item.id}`}
        rowIndex={rowIndex}
        colIndex={colIndex}
        onClick={() => handleItemClick(item)}
        style={{ flexShrink: 0 }}
      >
        <div style={styles.card}>
          <FallbackImage
            src={item.thumb}
            alt={item.title}
            style={styles.poster}
            loading="lazy"
            decoding="async"
          />
          {showUnwatchedIndicator && prefix !== 'cw' && (
            isUnwatched ? (
              <div 
                style={styles.unwatchedEpisodeRibbon} 
                className="unwatched-episode-ribbon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleWatched(item)
                }}
              >
                {/* Tick checkmark (Shown on hover/cursor) */}
                <svg className="unwatched-tick" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }}>
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
      `}</style>

      {libraries.length > 0 && (
        <NavigationBar
          libraries={libraries}
          activeTab={activeTab}
          onItemClick={handleNavClick}
        />
      )}

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
            <div style={styles.settingsContainer}>
              <h2 style={styles.sectionTitle}>Settings</h2>

              <div style={styles.settingsSection}>
                <h3 style={styles.settingsSubTitle}>Developer / Server</h3>
                <div style={styles.settingItemRow}>
                  <div style={styles.settingLabel}>Active Server URI</div>
                  <div style={{ color: '#aaa', fontSize: '18px', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '50%', textAlign: 'right' }}>
                    {serverInfo ? serverInfo.uri : 'Not connected'}
                  </div>
                </div>
              </div>

              <div style={styles.settingsSection}>
                <h3 style={styles.settingsSubTitle}>Appearance</h3>

                <div style={styles.settingItemRow}>
                  <div style={styles.settingLabel}>Show Unwatched Indicator</div>

                  <FocusableItem
                    id="toggle-unwatched"
                    rowIndex={0} // D-Pad navigation grid row
                    colIndex={0}
                    onClick={() => {
                      const newValue = !showUnwatchedIndicator
                      setShowUnwatchedIndicator(newValue)
                      setData(DB_KINDS.PREFERENCES, KINDS.preferences, {
                        showUnwatchedIndicator: newValue,
                        showNotifications
                      })
                    }}
                    className="setting-toggle"
                  >
                    <div style={styles.toggleCapsule}>
                      {showUnwatchedIndicator ? 'Enabled' : 'Disabled'}
                    </div>
                  </FocusableItem>
                </div>
                <div style={styles.settingItemRow}>
                  <div style={styles.settingLabel}>Show System Notifications</div>

                  <FocusableItem
                    id="toggle-notifications"
                    rowIndex={1}
                    colIndex={0}
                    onClick={() => {
                      const newValue = !showNotifications
                      setShowNotifications(newValue)
                      setData(DB_KINDS.PREFERENCES, KINDS.preferences, {
                        showUnwatchedIndicator,
                        showNotifications: newValue
                      })
                    }}
                    className="setting-toggle"
                  >
                    <div style={styles.toggleCapsule}>
                      {showNotifications ? 'Enabled' : 'Disabled'}
                    </div>
                  </FocusableItem>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const APP_BASE_COLOR = '#ffffff'
const APP_BASE_BACKGROUND = '#2f2f2f'

const styles = {
  container: {
    minHeight: '100vh',
    background: APP_BASE_BACKGROUND,
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
    maxWidth: '900px',
    margin: '0 auto',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '9999px',
    padding: '12px 32px',
    fontSize: '24px',
    fontWeight: '600',
    minWidth: '160px',
    textAlign: 'center',
    transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: APP_BASE_BACKGROUND,
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
    marginBottom: '35px',
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
    backgroundColor: 'rgba(229, 160, 13, 0.45)',
    border: '1.5px solid rgba(229, 160, 13, 0.6)',
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
    backgroundColor: 'rgba(90, 90, 90, 0.45)',
    border: '1.5px solid rgba(150, 150, 150, 0.6)',
    transform: 'rotate(45deg)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  }
}

export default ContentBrowserPage