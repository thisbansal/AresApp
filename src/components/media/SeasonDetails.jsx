import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'

export default function SeasonDetails({ item, serverInfo }) {
  const navigate = useNavigate()
  
  useEffect(() => {
    // TODO: Fetch episodes using /library/metadata/${item.id}/children
  }, [item.id, serverInfo])

  const handlePlay = () => {
    console.log('Play season:', item.id)
  }

  return (
    <div style={styles.container}>
      {item.parentTitle && <h3 style={styles.parentTitle}>{item.parentTitle}</h3>}
      <p style={styles.summary}>{item.summary || 'No summary available.'}</p>
      
      <ActionButtons onPlay={handlePlay} />

      {/* TODO: Render episodes list here */}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  parentTitle: {
    fontSize: '24px',
    color: '#aaa',
    margin: '0 0 12px 0',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  summary: {
    fontSize: '20px',
    lineHeight: '1.6',
    color: '#e8eaed',
    marginBottom: '24px',
    maxWidth: '900px',
  }
}
