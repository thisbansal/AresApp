import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMainToken } from '../services/luna/tokenStorage'
import { DB_KINDS, getData } from '../services/luna/lunaService'
import { KINDS } from '../config/app'
import { getMetadata, formatDuration } from '../services/plex/plexContentService'

import MovieDetails from '../components/media/MovieDetails'
import ShowDetails from '../components/media/ShowDetails'
import SeasonDetails from '../components/media/SeasonDetails'
import EpisodeDetails from '../components/media/EpisodeDetails'
import { FallbackImage } from '../components/media/FallbackImage'

function MediaDetailsPage() {
  const { ratingKey } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState(null)
  const [serverInfo, setServerInfo] = useState(location.state?.serverInfo || null)
  
  // Dynamic background and summary (Apple TV style)
  const [dynamicArt, setDynamicArt] = useState(null)
  const [dynamicSummary, setDynamicSummary] = useState(null)

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
        setDynamicArt(metadata.art)
        setDynamicSummary(null) // Reset dynamic summary when main item changes
      } catch (error) {
        console.error('[MediaDetailsPage] Error fetching metadata:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [ratingKey, navigate])

  const handleFocusItem = (focusedItem) => {
    if (focusedItem) {
      if (focusedItem.art) setDynamicArt(focusedItem.art);
      if (focusedItem.summary) setDynamicSummary(focusedItem.summary);
    } else {
      setDynamicArt(item.art);
      setDynamicSummary(null);
    }
  }

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
        return <ShowDetails item={item} serverInfo={serverInfo} onFocusItem={handleFocusItem} />
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
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      {/* Background Layer with blurred Art */}
      <div 
        style={{ 
          ...styles.backgroundArt, 
          backgroundImage: `url(${dynamicArt || item.art})`,
          opacity: 1,
          transition: 'background-image 0.5s ease-in-out'
        }} 
      />
      <div style={styles.backgroundOverlay} />

      {/* Content Layer (Apple TV Style) */}
      <div style={styles.contentWrapper}>
        <div style={styles.leftColumn}>
          <FallbackImage src={item.thumb} alt={item.title} style={styles.poster} />
        </div>

        <div style={styles.rightColumn}>
          <div style={styles.metaHeader}>
            <h1 style={styles.title}>{item.title}</h1>
            <div style={styles.badges}>
              {item.year && <span style={styles.badge}>{item.year}</span>}
              {item.rating && <span style={styles.badge}>{item.rating}</span>}
              {item.duration && <span style={styles.badge}>{formatDuration(item.duration)}</span>}
            </div>
          </div>
          
          <div style={styles.dynamicContent}>
            {renderDetails()}
          </div>
        </div>
      </div>

      {/* Floating Summary for focused episodes/seasons */}
      {dynamicSummary && (
        <div style={styles.floatingSummary}>
          <p>{dynamicSummary}</p>
        </div>
      )}
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
    overflow: 'hidden',
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
  backgroundArt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(40px)',
    transform: 'scale(1.1)', // Prevents blurred edges from showing background color
    zIndex: 1,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 20, 20, 0.7)', // Dark overlay for text readability
    backgroundImage: 'linear-gradient(to right, rgba(20,20,20,0.9) 0%, rgba(20,20,20,0.5) 100%)',
    zIndex: 2,
  },
  contentWrapper: {
    position: 'relative',
    zIndex: 3,
    display: 'flex',
    height: '100vh',
    padding: '80px',
    gap: '60px',
  },
  leftColumn: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  poster: {
    width: '400px',
    height: '600px',
    objectFit: 'cover',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
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
    justifyContent: 'center',
    paddingRight: '100px',
  },
  metaHeader: {
    marginBottom: '30px',
  },
  title: {
    fontSize: '64px',
    fontWeight: '700',
    margin: '0 0 16px 0',
    lineHeight: '1.1',
    textShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  badges: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  badge: {
    padding: '4px 10px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '500',
    backdropFilter: 'blur(10px)',
  },
  dynamicContent: {
    flex: 1,
    // overflowY: 'auto', removed to prevent button scaling from clipping on the left edge
  },
  floatingSummary: {
    position: 'absolute',
    bottom: '40px',
    left: '540px', // Align with right column content
    right: '100px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: '20px 30px',
    borderRadius: '16px',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    zIndex: 10,
    animation: 'fadeIn 0.3s ease-out',
  }
}

export default MediaDetailsPage
