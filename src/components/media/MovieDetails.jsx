import React from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'

export default function MovieDetails({ item, serverInfo, onFocusItem }) {
  const navigate = useNavigate()

  const handlePlay = () => {
    console.log('Play movie:', item.id)
    navigate(`/play/${item.id}`, { state: { serverInfo } })
  }

  const handleRestart = () => {
    console.log('Restart movie:', item.id)
    navigate(`/play/${item.id}`, { state: { serverInfo, startOver: true } })
  }

  return (
    <div style={styles.container}>
      {item.tagline && <h2 style={styles.tagline}>"{item.tagline}"</h2>}
      
      {item.directors && item.directors.length > 0 && (
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Director:</span> {item.directors.join(', ')}
        </div>
      )}
      
      {item.genres && item.genres.length > 0 && (
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Genres:</span> {item.genres.join(', ')}
        </div>
      )}

      <ActionButtons
        onPlay={handlePlay}
        onRestart={item.viewOffset ? handleRestart : null}
      />
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  tagline: {
    fontSize: '26px',
    fontStyle: 'italic',
    color: '#ccc',
    margin: '0 0 24px 0',
    fontWeight: '400',
  },
  summary: {
    fontSize: '22px',
    lineHeight: '1.6',
    color: '#e8eaed',
    marginBottom: '24px',
    maxWidth: '900px',
  },
  metaRow: {
    fontSize: '22px',
    color: '#e8eaed',
    marginBottom: '12px',
    lineHeight: '1.5',
  },
  metaLabel: {
    fontWeight: '700',
    color: '#fff',
    marginRight: '10px',
  }
}
