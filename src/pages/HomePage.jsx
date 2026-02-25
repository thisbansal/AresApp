import { useState, useEffect } from 'react'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getMainToken } from '../services/luna/tokenStorage'
import { getServers } from '../services/plex/plexAPIServer'

function HomePage() {

  const [allMovies, setAllMovies] = useState([])
  const [loading, setLoading] = useState(true)

  const ITEMS_PER_ROW = 6

  useEffect(() => {

    fetchAllMovies()
  }, [])

  // Build optimized image URL
  const buildImageUrl = (serverUri, path, token, width = 200, height = 300) => {
    if (!path) return null
    console.log('Image path:', path)
    return `${serverUri}${path}?X-Plex-Token=${token}&width=${width}&height=${height}&minSize=1&upscale=0&format=webp`
  }
  // Get all libraries from Plex
const getLibraries = async (serverUri, token) => {
  console.log('📚 [getLibraries] Fetching libraries from:', serverUri)
  const url = `${serverUri}/library/sections/all`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Plex-Token': token
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch libraries: ${response.status}`)
  }

  const data = await response.json()
  console.log('📚 [getLibraries] Raw response:', data)

  return data.MediaContainer.Directory.map(lib => ({
    id: lib.key,
    title: lib.title,
    type: lib.type,
    thumb: buildImageUrl(serverUri, lib.thumb, token, 100, 100), // Smaller!
  }))
}

  // Get items from a specific library
  const getLibraryItems = async (serverUri, token, libraryId, size = 500) => {

    const url = `${serverUri}/library/sections/${libraryId}/all?X-Plex-Token=${token}&X-Plex-Container-Start=0&X-Plex-Container-Size=${size}&sort=titleSort:asc`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': token,
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch library items: ${response.status}`)
    }

    const data = await response.json()


    const items = (data.MediaContainer.Metadata || []).map(item => ({
      id: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: buildImageUrl(serverUri, item.thumb, token, 200, 300),
      rating: item.contentRating,
      summary: item.summary,
    }))

    return items
  }

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
        getLibraryItems(serverUri, token, library.id, 500)
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
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#1a1a1a',
  },
  loadingText: {
    fontSize: '36px',
    color: PLEX_YELLOW,
  },
  emptyText: {
    fontSize: '36px',
    color: '#666',
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
    border: '3px solid transparent',
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