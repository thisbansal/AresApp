import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMainToken } from '../services/luna/tokenStorage'
import { DB_KINDS, getData } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { getMetadata, formatDuration } from '../services/plex/plexContentService'
import { useFocusStore } from '../stores/FocusStore'

import MovieDetails from '../components/media/MovieDetails'
import ShowDetails from '../components/media/ShowDetails'
import SeasonDetails from '../components/media/SeasonDetails'
import EpisodeDetails from '../components/media/EpisodeDetails'
import { FallbackImage } from '../components/media/FallbackImage'
import ActionButtons from '../components/media/ActionButtons'

// Deterministic hash function to map a title to a premium dark ambient gradient
const getBackgroundGradient = (title = '') => {
  const palettes = [
    'linear-gradient(135deg, #1b0a0d 0%, #0d0406 50%, #080808 100%)', // Deep Crimson
    'linear-gradient(135deg, #07120e 0%, #030706 50%, #080808 100%)', // Deep Emerald
    'linear-gradient(135deg, #09121d 0%, #04080e 50%, #080808 100%)', // Nordic Midnight
    'linear-gradient(135deg, #11091d 0%, #06030e 50%, #080808 100%)', // Royal Amethyst
    'linear-gradient(135deg, #1a1007 0%, #0a0603 50%, #080808 100%)', // Warm Amber
    'linear-gradient(135deg, #071417 0%, #03090a 50%, #080808 100%)', // Oceanic Teal
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

function MediaDetailsPage() {
  const { ratingKey } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState(null)
  const [serverInfo, setServerInfo] = useState(location.state?.serverInfo || null)

  const [playHandler, setPlayHandler] = useState(null)

  const handleRegisterPlay = useCallback((handler) => {
    setPlayHandler(() => handler)
  }, [])

  // Global Input Locking & Mode Management on Details view
  useEffect(() => {
    const handleGlobalMouseMove = () => {
      const { navigationMode } = useFocusStore.getState()
      if (navigationMode !== 'cursor') {
        useFocusStore.setState({ navigationMode: 'cursor' })
      }
    }

    const handleGlobalWheel = () => {
      // Wheel use locks out D-pad focus auto-scroll to prevent fighting
      useFocusStore.setState({ lastRemoteAction: Date.now() })
      if (window.lockVerticalScroll) {
        window.lockVerticalScroll()
      }
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('wheel', handleGlobalWheel)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('wheel', handleGlobalWheel)
      if (window.unlockVerticalScroll) {
        window.unlockVerticalScroll()
      }
    }
  }, [])

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true)
      try {
        let uri = serverInfo?.uri
        let token = serverInfo?.token

        if (!uri || !token) {
          token = await getMainToken()
          uri = await getData(DB_KINDS.SERVER, KINDS.server)

          if (!token || !uri) {
            navigate('/')
            return
          }
          setServerInfo({ uri, token })
        }

        const metadata = await getMetadata(uri, token, ratingKey)
        setItem(metadata)
      } catch (error) {
        console.error('[MediaDetailsPage] Error fetching metadata:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [ratingKey, navigate])

  const handleFocusItem = () => {}

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
      </div>
    )
  }

  if (!item) {
    return (
      <div style={styles.errorContainer}>
        <h2>Item not found</h2>
        <button onClick={() => navigate(-1)} style={styles.backButton}>Go Back</button>
      </div>
    )
  }

  // Determine which specialized view to render
  const renderDetails = () => {
    switch (item.type) {
      case 'movie':
        return <MovieDetails item={item} serverInfo={serverInfo} onFocusItem={handleFocusItem} />
      case 'show':
        return <ShowDetails item={item} serverInfo={serverInfo} onFocusItem={handleFocusItem} onRegisterPlay={handleRegisterPlay} />
      case 'season':
        return <SeasonDetails item={item} serverInfo={serverInfo} onFocusItem={handleFocusItem} />
      case 'episode':
        return <EpisodeDetails item={item} serverInfo={serverInfo} onFocusItem={handleFocusItem} />
      default:
        return <div>Unsupported media type: {item.type}</div>
    }
  }

  return (
    <div style={styles.container}>
      <style>{`
        *::-webkit-scrollbar { display: none !important; }
        * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Dynamic Ambient Background Gradient */}
      <div
        style={{
          ...styles.backgroundContainer,
          background: getBackgroundGradient(item.title),
        }}
      >
        <div style={styles.ambientGlow} />
      </div>

      {/* Content Layer (Apple TV Style) */}
      <div style={styles.contentWrapper}>
        <div style={styles.leftColumn}>
          <FallbackImage src={item.thumb} alt={item.title} style={styles.poster} />
          {item.type === 'show' && playHandler && (
            <div style={styles.leftColumnButtons}>
              <ActionButtons onPlay={playHandler} rowIndex={1} />
            </div>
          )}
        </div>

        <div style={styles.rightColumn}>
          <div style={styles.metaHeader}>
            <h1 style={styles.title}>{item.title}</h1>
            <div style={styles.badges}>
              {item.year && <span style={styles.badge}>{item.year}</span>}
              {item.rating && <span style={styles.badge}>{item.rating}</span>}
              {item.duration && <span style={styles.badge}>{formatDuration(item.duration)}</span>}
            </div>

            {/* Contextual Title */}
            <h2 style={styles.contextTitle}>
              {item.type === 'movie' ? 'Synopsis' :
               item.type === 'show' ? 'About this Show' :
               item.type === 'season' ? 'About this Season' :
               'About this episode'}
            </h2>

            {/* Main Integrated Summary Area */}
            <p style={styles.mainSummary} className="summary-text">
              {item.summary || 'No description available.'}
            </p>
          </div>

          <div style={styles.dynamicContent}>
            {renderDetails()}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    width: '100vw',
    position: 'relative',
    backgroundColor: '#141414',
    color: '#fff',
    overflowX: 'hidden',
  },
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255,255,255,0.1)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
  },
  backButton: {
    marginTop: '20px',
    padding: '10px 20px',
    fontSize: '18px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  backgroundContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    top: '-30%',
    left: '-30%',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)',
    filter: 'blur(120px)',
    pointerEvents: 'none',
  },
  contentWrapper: {
    position: 'relative',
    zIndex: 3,
    display: 'flex',
    minHeight: '100vh',
    padding: '80px 80px 80px 80px',
    gap: '60px',
  },
  leftColumn: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  poster: {
    width: '400px',
    height: '600px',
    objectFit: 'cover',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
  },
  leftColumnButtons: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  posterPlaceholder: {
    width: '400px',
    height: '600px',
    backgroundColor: '#333',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    textAlign: 'center',
    padding: '20px',
  },
  rightColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  metaHeader: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '64px',
    fontWeight: '700',
    margin: '0 0 16px 0',
    lineHeight: '1.1',
    textShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  contextTitle: {
    fontSize: '24px',
    color: '#fff', // Changed from gold to white as requested
    margin: '20px 0 10px 0',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    fontWeight: '600',
    animation: 'fadeIn 0.3s ease-out',
  },
  mainSummary: {
    fontSize: '20px',
    lineHeight: '1.6',
    color: '#e8eaed',
    margin: '0 0 30px 0',
    maxWidth: '900px',
    minHeight: '100px', // Prevent layout jump
    animation: 'fadeIn 0.4s ease-out',
  },
  badges: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  badge: {
    padding: '4px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    fontSize: '24px',
    fontWeight: '500',
  },
  dynamicContent: {
    flex: 1,
    minWidth: 0,
  }
}

export default MediaDetailsPage
