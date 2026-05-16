import React from 'react'
import { FallbackImage } from './FallbackImage'

export default function CastScroller({ cast = [] }) {
  if (!cast || cast.length === 0) return null

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Cast & Crew</h3>
      <div style={styles.scroller} className="hide-scrollbar">
        {cast.slice(0, 15).map((person, i) => (
          <div key={i} style={styles.personCard}>
            <div style={styles.avatarWrapper}>
              <FallbackImage src={person.thumb} alt={person.name} style={styles.avatar} loading="lazy" />
            </div>
            <div style={styles.name}>{person.name}</div>
            <div style={styles.role}>{person.role}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    marginTop: '40px',
  },
  header: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#aaa',
    marginBottom: '20px',
  },
  scroller: {
    display: 'flex',
    gap: '24px',
    overflowX: 'auto',
    paddingBottom: '20px',
  },
  personCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '120px',
    flexShrink: 0,
    textAlign: 'center',
  },
  avatarWrapper: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    overflow: 'hidden',
    marginBottom: '12px',
    backgroundColor: '#333',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: '700',
    color: '#666',
  },
  name: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#e8eaed',
    marginBottom: '4px',
  },
  role: {
    fontSize: '14px',
    color: '#888',
  }
}
