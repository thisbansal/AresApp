import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useActiveServer } from '../hooks/useActiveServer'
import { getMetadata, formatDuration } from '../services/plex/plexContentService'
import { useSpatialNavigation } from '../contexts/SpatialNavigationContext'
import { usePlexQuery } from '../hooks/usePlexQuery'

import MovieDetails from '../components/media/MovieDetails'
import ShowDetails from '../components/media/ShowDetails'
import SeasonDetails from '../components/media/SeasonDetails'
import EpisodeDetails from '../components/media/EpisodeDetails'
import { FallbackImage } from '../components/media/FallbackImage'

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

  const stateItem = (location.state?.item && String(location.state.item.id || location.state.item.ratingKey) === String(ratingKey))
    ? location.state.item
    : null

  const [loading, setLoading] = useState(!stateItem)
  const [item, setItem] = useState(stateItem)
  const [metadataLoaded, setMetadataLoaded] = useState(false)
  const [serverInfo, serverLoading] = useActiveServer(location.state?.serverInfo, navigate)
  const { navigationMode, setNavigationMode, lastRemoteActionRef } = useSpatialNavigation()

  const [playHandler, setPlayHandler] = useState(null)

  const handleRegisterPlay = useCallback((handler) => {
    setPlayHandler(() => handler)
  }, [])

  // Global Input Locking & Mode Management on Details view
  useEffect(() => {
    const handleGlobalMouseMove = () => {
      if (navigationMode !== 'cursor') {
        setNavigationMode('cursor')
      }
    }

    const handleGlobalWheel = () => {
      // Wheel use locks out D-pad focus auto-scroll to prevent fighting
      lastRemoteActionRef.current = Date.now()
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

  // Fetch Details using usePlexQuery
  const {
    data: queryMetadata,
    loading: queryLoading,
  } = usePlexQuery(
    ['media_metadata', ratingKey, serverInfo?.uri],
    async () => {
      if (!serverInfo || !ratingKey) return null;
      const metadata = await getMetadata(serverInfo.uri, serverInfo.token, ratingKey)
      return metadata;
    },
    { enabled: !serverLoading && !!serverInfo && !!ratingKey }
  );

  // Sync / Process redirect or local update
  useEffect(() => {
    if (!queryMetadata) return;

    // Unified Details: Redirect season/episode views to the main parent/grandparent Show details page
    if (queryMetadata.type === 'episode' && queryMetadata.grandparentRatingKey) {
      console.log(`[MediaDetailsPage] Unified Redirect: episode ${ratingKey} -> show ${queryMetadata.grandparentRatingKey}`)
      navigate(`/details/${queryMetadata.grandparentRatingKey}`, { replace: true, state: { serverInfo } })
      return
    } else if (queryMetadata.type === 'season' && queryMetadata.parentRatingKey) {
      console.log(`[MediaDetailsPage] Unified Redirect: season ${ratingKey} -> show ${queryMetadata.parentRatingKey}`)
      navigate(`/details/${queryMetadata.parentRatingKey}`, { replace: true, state: { serverInfo } })
      return
    }

    setItem(queryMetadata);
    setMetadataLoaded(true);
  }, [queryMetadata, ratingKey, serverInfo, navigate]);

  // Loading state management
  useEffect(() => {
    // If we have a stateItem, we can show it immediately, so loading is false
    if (stateItem) {
      setLoading(false);
    } else {
      setLoading(queryLoading);
    }
  }, [queryLoading, stateItem]);

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

  const getMediaBadges = (item) => {
    const badges = []
    
    // Check if we have media streams info
    const mediaObj = item.media?.[0]
    if (mediaObj) {
      // 1. Resolution Badge
      let res = mediaObj.videoResolution
      if (res) {
        if (res.toLowerCase() === '4k' || res === '2160') {
          badges.push({ text: '4K UHD', type: 'resolution', color: '#e5a00d' })
        } else if (res.toLowerCase() === '1080' || res.toLowerCase() === '1080p') {
          badges.push({ text: '1080p HD', type: 'resolution', color: '#ffffff' })
        } else if (res.toLowerCase() === '720' || res.toLowerCase() === '720p') {
          badges.push({ text: '720p HD', type: 'resolution', color: '#aaaaaa' })
        } else {
          badges.push({ text: `${res.toUpperCase()}`, type: 'resolution', color: '#aaaaaa' })
        }
      }

      // 2. HDR / Dolby Vision Badge
      if (mediaObj.videoCodec === 'hevc' && (res === '4k' || res === '2160' || res === '1080')) {
        badges.push({ text: 'HDR', type: 'hdr', color: '#ff5c5c' })
        badges.push({ text: 'Dolby Vision', type: 'dolby-vision', color: '#e5a00d' })
      } else if (mediaObj.videoCodec === 'hevc') {
        badges.push({ text: 'HEVC', type: 'hdr', color: '#aaaaaa' })
      }

      // 3. Audio Channels / Codec Badge
      let audio = mediaObj.audioCodec
      let channels = mediaObj.audioChannels
      if (audio || channels) {
        let audioText = ''
        if (audio) {
          if (audio.toLowerCase() === 'ac3' || audio.toLowerCase() === 'eac3') {
            audioText = 'Dolby Digital'
          } else if (audio.toLowerCase() === 'dca' || audio.toLowerCase() === 'dts') {
            audioText = 'DTS'
          } else if (audio.toLowerCase() === 'truehd') {
            audioText = 'Dolby Atmos'
          } else {
            audioText = audio.toUpperCase()
          }
        }
        if (channels) {
          if (channels === 6) {
            audioText += ' 5.1'
          } else if (channels === 8) {
            audioText += ' 7.1'
          } else if (channels === 2) {
            audioText += ' Stereo'
          } else {
            audioText += ` ${channels}ch`
          }
        }
        badges.push({ text: audioText.trim(), type: 'audio', color: '#00ccff' })
      }
    } else {
      // Default placeholder badges for Shows/Seasons that don't have direct item.media structure
      if (item.type === 'show') {
        badges.push({ text: '1080p HD', type: 'resolution', color: '#ffffff' })
        badges.push({ text: 'Dolby Digital 5.1', type: 'audio', color: '#00ccff' })
      }
    }

    return badges
  }

  // Determine which specialized view to render
  const renderDetails = () => {
    switch (item.type) {
      case 'movie':
        return <MovieDetails item={item} serverInfo={serverInfo} onFocusItem={handleFocusItem} />
      case 'show':
        return <ShowDetails item={item} contextItem={location.state?.item} serverInfo={serverInfo} onFocusItem={handleFocusItem} onRegisterPlay={handleRegisterPlay} />
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

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(330%); }
        }
      `}</style>

      {/* Shimmer loading bar when background pre-populating */}
      {!metadataLoaded && stateItem && (
        <div style={styles.backgroundProgressBar}>
          <div style={styles.progressBarFill}></div>
        </div>
      )}

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
          <FallbackImage
            src={item.thumb}
            itemId={item.ratingKey}
            alt={item.title}
            style={{
              ...styles.poster,
              viewTransitionName: 'active-poster'
            }}
          />
          
          {/* Render premium media specs badges under the poster */}
          <div style={styles.mediaBadgesContainer}>
            {getMediaBadges(item).map((badge, idx) => (
              <div 
                key={idx} 
                style={styles.mediaBadge}
              >
                {badge.text}
              </div>
            ))}
          </div>
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
  },
  mediaBadgesContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '14px',
    marginTop: '25px',
    width: '400px',
  },
  mediaBadge: {
    padding: '8px 18px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
    fontSize: '18px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '42px',
    boxSizing: 'border-box',
    color: '#ffffff',
  },
  backgroundProgressBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    zIndex: 9999,
  },
  progressBarFill: {
    height: '100%',
    width: '30%',
    background: 'linear-gradient(90deg, transparent, #e5a00d, transparent)',
    animation: 'shimmer 1.5s infinite linear',
  }
}

export default MediaDetailsPage
