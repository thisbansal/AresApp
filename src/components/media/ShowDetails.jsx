import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'
import CastScroller from './CastScroller'
import { FocusableItem } from '../navigational/FocusableItem'

export default function ShowDetails({ item, serverInfo }) {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState([])

  useEffect(() => {
    // TODO: Fetch seasons using /library/metadata/${item.id}/children
    // For now we'll just display the summary and cast
  }, [item.id, serverInfo])

  const handlePlay = () => {
    console.log('Play show (resume):', item.id)
  }

  return (
    <div style={styles.container}>
      <p style={styles.summary}>{item.summary}</p>
      
      {item.genres && item.genres.length > 0 && (
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Genres:</span> {item.genres.join(', ')}
        </div>
      )}

      <ActionButtons onPlay={handlePlay} onMore={() => console.log('More info')} />

      {/* TODO: Render seasons row here */}

      <CastScroller cast={item.actors} />
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
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
