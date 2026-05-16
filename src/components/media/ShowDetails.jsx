import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'
import CastScroller from './CastScroller'
import { FocusableItem } from '../navigational/FocusableItem'
import { getChildren } from '../../services/plex/plexContentService'
import { FallbackImage } from './FallbackImage'

export default function ShowDetails({ item, serverInfo }) {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState([])

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        if (!serverInfo?.uri || !serverInfo?.token || !item.id) return
        const children = await getChildren(serverInfo.uri, serverInfo.token, item.id)
        setSeasons(children)
      } catch (err) {
        console.error('Failed to fetch seasons:', err)
      }
    }
    fetchSeasons()
  }, [item.id, serverInfo])

  const handlePlay = () => {
    console.log('Play show (resume):', item.id)
  }

  const handleSeasonClick = (seasonId) => {
    navigate(`/details/${seasonId}`, { state: { serverInfo } })
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

      {seasons.length > 0 && (
        <div style={styles.seasonsContainer}>
          <h3 style={styles.header}>Seasons</h3>
          <div style={styles.scroller} className="hide-scrollbar row-items row">
            {seasons.map((season, i) => (
              <FocusableItem
                key={season.id}
                id={`season-${season.id}`}
                rowIndex={1}
                colIndex={i}
                onClick={() => handleSeasonClick(season.id)}
                className="season-card"
              >
                <div style={styles.seasonInner}>
                  <FallbackImage src={season.thumb} alt={season.title} style={styles.seasonPoster} loading="lazy" />
                  <div style={styles.seasonTitle}>{season.title}</div>
                </div>
              </FocusableItem>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .season-card {
          border-radius: 12px;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .season-card.focused {
          transform: scale(1.05);
          z-index: 10;
        }
        .season-card.focused img, .season-card.focused .fallback-placeholder {
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
          border: 2px solid #fff;
        }
      `}</style>

      <CastScroller cast={item.actors} rowIndexOffset={2} />
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
  },
  seasonsContainer: {
    marginTop: '30px',
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
    paddingBottom: '30px',
    paddingLeft: '10px',
    marginLeft: '-10px',
  },
  seasonInner: {
    width: '160px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
  },
  seasonPoster: {
    width: '160px',
    height: '240px',
    borderRadius: '12px',
    objectFit: 'cover',
    backgroundColor: '#222',
    marginBottom: '12px',
    boxSizing: 'border-box',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  seasonTitle: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  }
}
