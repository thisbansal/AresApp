import React from 'react'
import { FallbackImage } from './FallbackImage'
import { FocusableItem } from '../navigational/FocusableItem'

export default function CastScroller({ cast = [], rowIndexOffset = 2, onFocusItem }) {
  if (!cast || cast.length === 0) return null

  return (
    <div style={styles.container} className="row">
      <h3 style={styles.header}>Cast & Crew</h3>
      <div style={styles.scroller} className="hide-scrollbar row-items">
        {cast.slice(0, 15).map((person, i) => (
          <FocusableItem
            key={i}
            id={`cast-${i}`}
            rowIndex={rowIndexOffset}
            colIndex={i}
            onClick={() => console.log('Clicked cast:', person.name)}
            onFocus={() => onFocusItem?.(null)} // Reset art when focusing cast
            className="cast-card"
          >
            <div style={styles.personCard}>
              <div style={styles.avatarWrapper} className="avatar-wrapper">
                <FallbackImage src={person.thumb} alt={person.name} style={styles.avatar} loading="lazy" />
              </div>
              <div style={styles.name}>{person.name}</div>
              <div style={styles.role}>{person.role}</div>
            </div>
          </FocusableItem>
        ))}
      </div>

      <style>{`
        .cast-card {
          flex-shrink: 0;
          border-radius: 12px;
          padding: 8px;
          margin: -8px;
          transition: transform 0.2s ease;
        }
        .cast-card.focused {
          transform: scale(1.1);
          z-index: 10;
        }
        .cast-card.focused .avatar-wrapper {
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.3);
          border: 2px solid #fff;
        }
      `}</style>
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
    paddingTop: '30px', // Room for focus scale
    paddingBottom: '30px',
    marginTop: '-30px', // Compensate for padding
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
