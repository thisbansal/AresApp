import React from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'

export default function EpisodeDetails({ item, serverInfo }) {
  const navigate = useNavigate()
  
  const handlePlay = () => {
    console.log('Play episode:', item.id)
    navigate(`/play/${item.id}`, { state: { serverInfo } })
  }

  const handleRestart = () => {
    console.log('Restart episode:', item.id)
    navigate(`/play/${item.id}`, { state: { serverInfo, startOver: true } })
  }

  return (
    <div style={styles.container}>
      {item.parentTitle && item.grandparentTitle && (
        <h3 style={styles.showTitle}>
          {item.grandparentTitle} • {item.parentTitle} • Episode {item.index}
        </h3>
      )}
      
      <p style={styles.summary}>{item.summary || 'No summary available.'}</p>
      
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
  showTitle: {
    fontSize: '20px',
    color: '#aaa',
    margin: '0 0 16px 0',
    fontWeight: '500',
    letterSpacing: '1px',
  },
  summary: {
    fontSize: '20px',
    lineHeight: '1.6',
    color: '#e8eaed',
    marginBottom: '24px',
    maxWidth: '900px',
  }
}
