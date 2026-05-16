import { useState, useEffect } from 'react'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { NavigationBar } from '../components/navigational/NavigationBar'
import { getMainToken } from '../services/luna/tokenStorage'
import { DB_KINDS, getData, setData } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { getServers, getBestServerConnection } from '../services/plex/plexAPIServer'
import { getOnDeck, getRecentlyAdded, getLibraries, getLibraryItems } from '../services/plex/plexContentService'

function ContentBrowserPage() {

  // State
  const [serverInfo, setServerInfo] = useState(null)
  const [libraries, setLibraries] = useState([])
  const [activeTab, setActiveTab] = useState({ type: 'home' })
  
  // Content State
  const [continueWatching, setContinueWatching] = useState([])
  const [recentMovies, setRecentMovies] = useState([])
  const [recentTv, setRecentTv] = useState([])
  const [libraryContent, setLibraryContent] = useState({ all: [] })
  
  const [loading, setLoading] = useState(true)

  const ITEMS_PER_ROW = 9

  // 1. Initialise Server Info and Libraries
  useEffect(() => {
    const initServerAndNav = async () => {
      try {
        const token = await getMainToken()
        if (!token) return

        // 1. Fast Path: Try to boot instantly using the last known server address
        let currentUri = await getData(DB_KINDS.SERVER, KINDS.server)
        
        if (currentUri) {
          setServerInfo({ uri: currentUri, token })
          // Don't await this, let it run asynchronously so it doesn't block the background check if the URI is unreachable
          getLibraries(currentUri, token).then(setLibraries).catch(e => console.warn('Fast path getLibraries failed:', e))
        }

        // 2. Background Check: Look for a better/restored local connection
        const servers = await getServers(token)
        if (!servers || servers.length === 0) return

        const server = servers[0]
        const bestUri = await getBestServerConnection(server, token)

        if (bestUri && bestUri !== currentUri) {
          console.log('[initServerAndNav] Background check updating to better URI:', bestUri)
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
        img.onerror = resolve // Resolve even on error to prevent hanging
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

  const handleItemClick = (item) => {
    console.log('Selected item:', item)
  }

  const handleNavClick = (navItem) => {
    if (navItem.type === 'settings') {
      console.log('Settings clicked')
      return // Do nothing for now
    }
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
      >
        <div style={styles.card}>
          <img
            src={item.thumb}
            alt={item.title}
            style={styles.poster}
            loading="lazy"
            decoding="async"
          />
          {isUnwatched && (
            <div style={styles.unwatchedRibbon} />
          )}
          {item.viewOffset && item.duration && (
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
      `}</style>

      {libraries.length > 0 && (
        <NavigationBar libraries={libraries} activeTab={activeTab} onItemClick={handleNavClick} />
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
                    <div style={styles.section}>
                      <h2 style={styles.sectionTitle}>Continue Watching</h2>
                      <div style={styles.row} className="hide-scrollbar">
                        {continueWatching.map((item, index) => renderCard(item, 0, index, 'cw'))}
                      </div>
                    </div>
                  )}

                  {recentMovies.length > 0 && (
                    <div style={styles.section}>
                      <h2 style={styles.sectionTitle}>Recently Added Movies</h2>
                      <div style={styles.row} className="hide-scrollbar">
                        {recentMovies.map((item, index) => renderCard(item, 1, index, 'rm'))}
                      </div>
                    </div>
                  )}

                  {recentTv.length > 0 && (
                    <div style={styles.section}>
                      <h2 style={styles.sectionTitle}>Recently Added TV Shows</h2>
                      <div style={styles.row} className="hide-scrollbar">
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
                    <div style={styles.section}>
                      <h2 style={styles.sectionTitle}>All {activeTab.data.title}</h2>
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
    gap: '20px',
  },
  sectionTitle: {
    fontSize: '32px',
    color: '#e8eaed',
    margin: 0,
    fontWeight: '600',
  },
  row: {
    display: 'flex',
    gap: '30px',
    overflowX: 'auto',
    padding: '20px 30px',
    margin: '0 -30px',
    scrollbarWidth: 'none', 
    msOverflowStyle: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(9, 180px)',
    gap: '30px',
    padding: '20px 0',
  },
  card: {
    position: 'relative',
    cursor: 'pointer',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  poster: {
    width: '180px',
    height: '270px',
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
  unwatchedRibbon: {
    position: 'absolute',
    top: '-24px',
    right: '-24px',
    width: '48px',
    height: '48px',
    background: '#0078d7', 
    transform: 'rotate(45deg)',
    zIndex: 2,
    boxShadow: '0 0 10px rgba(0,0,0,0.7)',
  }
}

export default ContentBrowserPage