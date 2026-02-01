import { useState, useEffect } from 'react'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getCachedImage } from '../services/initializationService'

/**
 * HomePage - Shows pre-loaded data instantly
 *
 * All heavy lifting is done before this component mounts
 * Images are already cached and ready to display
 */
function HomePage({ initialData }) {
  const [allMovies, setAllMovies] = useState(initialData?.movies || [])
  const [visibleStart, setVisibleStart] = useState(0)
  const [imageUrls, setImageUrls] = useState({})

  const ITEMS_PER_ROW = 6
  const VISIBLE_ROWS = 4
  const ITEMS_PER_LOAD = ITEMS_PER_ROW * VISIBLE_ROWS

  useEffect(() => {
    // Load cached image URLs
    loadImageUrls()
  }, [allMovies])

  useEffect(() => {
    // Update movies if initialData changes (background sync)
    if (initialData?.movies) {
      setAllMovies(initialData.movies)
    }
  }, [initialData])

  const loadImageUrls = async () => {
    console.log('[HomePage] Loading cached image URLs...')
    const urls = {}

    // Load first 24 images (what's visible)
    const visible = allMovies.slice(0, 24)
    console.log('[HomePage] Loading URLs for', visible.length, 'visible movies')

    for (const movie of visible) {
      const url = await getCachedImage(movie.id)
      if (url) {
        urls[movie.id] = url
        console.log('[HomePage] ✓ Loaded cached image for:', movie.title, '(ID:', movie.id, ')')
      } else {
        console.log('[HomePage] ✗ No cached image for:', movie.title, '(ID:', movie.id, ') - will fetch from network')
      }
    }

    console.log('[HomePage] Total cached images loaded:', Object.keys(urls).length, '/', visible.length)
    setImageUrls(urls)
  }

  const visibleMovies = allMovies.slice(visibleStart, visibleStart + ITEMS_PER_LOAD)
  const hasMore = visibleStart + ITEMS_PER_LOAD < allMovies.length
  const hasPrev = visibleStart > 0

  const handleNext = () => {
    if (hasMore) {
      setVisibleStart(prev => prev + ITEMS_PER_ROW)
    }
  }

  const handlePrev = () => {
    if (hasPrev) {
      setVisibleStart(prev => Math.max(0, prev - ITEMS_PER_ROW))
    }
  }

  const handleItemClick = (item) => {
    console.log('Selected item:', item)
    // TODO: Navigate to detail page
  }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'PageDown') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'PageUp') {
        e.preventDefault()
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [hasMore, hasPrev])

  console.log('[HomePage] Rendering with', allMovies.length, 'movies')
  console.log('[HomePage] Cached image URLs loaded:', Object.keys(imageUrls).length)

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Movies</span>
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {visibleMovies.map((item, index) => {
          const rowIndex = Math.floor(index / ITEMS_PER_ROW)
          const colIndex = index % ITEMS_PER_ROW
          const imageSrc = imageUrls[item.id] || item.thumb

          return (
            <FocusableItem
              key={`${item.id}-${visibleStart + index}`}
              id={`poster-${item.id}`}
              rowIndex={rowIndex}
              colIndex={colIndex}
              onClick={() => handleItemClick(item)}
            >
              <div style={styles.card}>
                <img
                  src={imageSrc}
                  alt={item.title}
                  style={styles.poster}
                  loading="eager"
                  decoding="sync" // Sync for instant display
                />
                <div style={styles.info}>
                  <div style={styles.movieTitle}>{item.title}</div>
                  {item.year && (
                    <div style={styles.movieYear}>{item.year}</div>
                  )}
                </div>
              </div>
            </FocusableItem>
          )
        })}
      </div>

      {/* Navigation hints */}
      <div style={styles.navHints}>
        {hasPrev && <span style={styles.hint}>↑ PageUp for Previous</span>}
        {hasMore && <span style={styles.hint}>↓ PageDown for Next</span>}
      </div>
    </div>
  )
}

const PLEX_YELLOW = '#e5a00d'

const styles = {
  container: {
    minHeight: '100vh',
    background: '#1a1a1a',
    color: '#e8eaed',
    padding: '40px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    // GPU acceleration
    willChange: 'transform',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    perspective: 1000,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '2px solid #333',
  },
  title: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: PLEX_YELLOW,
  },
  counter: {
    fontSize: '28px',
    color: '#9aa0a6',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 280px)',
    gap: '40px',
    justifyContent: 'center',
    // Performance optimizations
    willChange: 'contents',
    contain: 'layout style paint',
  },
  card: {
    position: 'relative',
    cursor: 'pointer',
    // GPU acceleration
    willChange: 'transform',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
  },
  poster: {
    width: '280px',
    height: '420px',
    objectFit: 'cover',
    borderRadius: '12px',
    background: '#222',
    display: 'block',
    border: '3px solid transparent',
    transition: 'border-color 0.15s ease',
    // GPU acceleration
    willChange: 'transform',
    transform: 'translateZ(0)',
    imageRendering: 'high-quality',
  },
  info: {
    marginTop: '10px',
    textAlign: 'center',
  },
  movieTitle: {
    fontSize: '24px',
    color: '#e8eaed',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  movieYear: {
    fontSize: '20px',
    color: '#9aa0a6',
    marginTop: '5px',
  },
  navHints: {
    display: 'flex',
    gap: '40px',
    justifyContent: 'center',
    marginTop: '20px',
  },
  hint: {
    fontSize: '24px',
    color: '#666',
    padding: '10px 20px',
    background: '#222',
    borderRadius: '8px',
  },
}

export default HomePage