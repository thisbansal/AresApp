import { useState, useEffect } from 'react'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getMainToken } from '../services/luna/tokenStorage'
import { getServers } from '../services/plex/plexAPIServer'
import { getLibraries, getLibraryItems } from '../services/plex/plexContentService'

function HomePage() {

  const [allMovies, setAllMovies] = useState([])
  const [loading, setLoading] = useState(true)

  const ITEMS_PER_ROW = 6

  useEffect(() => {
    fetchAllMovies()
  }, [])

  const fetchAllMovies = async () => {
    try {
      setLoading(true)
      const token = await getMainToken()

      if (!token) {
        setLoading(false)
        return
      }

      const servers = await getServers(token)

      if (!servers || servers.length === 0) {
        setLoading(false)
        return
      }

      // Use the first server
      const server = servers[0]

      // Get the first connection (prioritize local connections)
      const localConnection = server.connections?.find(conn => conn.local === true)
      const connection = localConnection || server.connections?.[0]

      if (!connection) {
        setLoading(false)
        return
      }

      const serverUri = connection.uri

      if (!serverUri) {
        setLoading(false)
        return
      }

      const libraries = await getLibraries(serverUri, token)

      const movieLibraries = libraries.filter(lib => lib.title === 'Movies')

      if (movieLibraries.length === 0) {
        console.warn('⚠️ [fetchAllMovies] No movie libraries found')
        setLoading(false)
        return
      }

      const allMoviesPromises = movieLibraries.map(library =>
        getLibraryItems(serverUri, token, 1)
      )

      const results = await Promise.all(allMoviesPromises)

      const combinedMovies = results.flat()


      setAllMovies(combinedMovies)
      setLoading(false)

    } catch (error) {
      console.error('❌ [fetchAllMovies] Error:', error)
      console.error('❌ [fetchAllMovies] Stack:', error.stack)
      setLoading(false)
    }
  }

  const handleItemClick = (item) => {
    console.log('Selected item:', item)
  }


  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Loading movies...</div>
      </div>
    )
  }

  if (allMovies.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.emptyText}>No movies found</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>

      <div style={styles.grid}>
        {allMovies.map((item, index) => {
          const rowIndex = Math.floor(index / ITEMS_PER_ROW)
          const colIndex = index % ITEMS_PER_ROW

          return (
            <FocusableItem
              key={`${item.id}-${index}`}
              id={`poster-${item.id}`}
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
              </div>
            </FocusableItem>
          )
        })}
      </div>

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
    padding: '40px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: APP_BASE_BACKGROUND,
  },
  loadingText: {
    fontSize: '4rem',
    color: APP_BASE_COLOR,
  },
  emptyText: {
    fontSize: '36px',
    color: '#666',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 280px)',
    gap: '40px',
    justifyContent: 'center',
  },
  card: {
    position: 'relative',
    cursor: 'pointer',
  },
  poster: {
    width: '280px',
    height: '420px',
    objectFit: 'cover',
    borderRadius: '12px',
    background: '#222',
    display: 'block',
    transition: 'border-color 0.15s ease',
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
  hint: {
    fontSize: '24px',
    color: '#666',
    padding: '10px 20px',
    background: '#222',
    borderRadius: '8px',
  },
}

export default HomePage