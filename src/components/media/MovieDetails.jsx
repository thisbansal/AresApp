import React from 'react'
import ActionButtons from './ActionButtons'

export default function MovieDetails({ item, serverInfo, onFocusItem }) {
  const handlePlay = () => {
    console.log('Play movie:', item.id)
    // TODO: Navigate to player route
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

      <ActionButtons onPlay={handlePlay} />
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  tagline: {
    fontSize: '24px',
    fontStyle: 'italic',
    color: '#ccc',
    margin: '0 0 20px 0',
    fontWeight: '400',
  },
  summary: {
    fontSize: '20px',
    lineHeight: '1.6',
    color: '#e8eaed',
    marginBottom: '24px',
    maxWidth: '900px',
  },
  metaRow: {
    fontSize: '18px',
    color: '#ccc',
    marginBottom: '8px',
  },
  metaLabel: {
    fontWeight: '600',
    color: '#fff',
    marginRight: '8px',
  }
}
