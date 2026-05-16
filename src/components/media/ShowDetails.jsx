import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'
import CastScroller from './CastScroller'
import { FocusableItem } from '../navigational/FocusableItem'
import { getChildren } from '../../services/plex/plexContentService'
import { FallbackImage } from './FallbackImage'
import { useNotificationStore } from '../../services/notifications/notificationStore'

export default function ShowDetails({ item, serverInfo, onFocusItem }) {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState([])
  const [activeSeasonId, setActiveSeasonId] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)

  // 1. Fetch Seasons
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        if (!serverInfo?.uri || !serverInfo?.token || !item.id) return
        const children = await getChildren(serverInfo.uri, serverInfo.token, item.id)
        setSeasons(children)
        
        // Auto-select first season
        if (children.length > 0 && !activeSeasonId) {
          setActiveSeasonId(children[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch seasons:', err)
      }
    }
    fetchSeasons()
  }, [item.id, serverInfo])

  // 2. Fetch Episodes when Active Season changes
  useEffect(() => {
    const fetchEpisodes = async () => {
      if (!activeSeasonId || !serverInfo?.uri) return
      setLoadingEpisodes(true)
      try {
        const children = await getChildren(serverInfo.uri, serverInfo.token, activeSeasonId)
        setEpisodes(children)
      } catch (err) {
        console.error('Failed to fetch episodes:', err)
      } finally {
        setLoadingEpisodes(false)
      }
    }
    fetchEpisodes()
  }, [activeSeasonId, serverInfo])

  const handlePlay = () => {
    // If we have episodes, play the first one (or resume point if we had it)
    if (episodes.length > 0) {
      handleEpisodeClick(episodes[0])
    }
  }

  const handleEpisodeClick = (episode) => {
    console.log('Play episode:', episode.title)
    // TODO: Navigate to player
    useNotificationStore.getState().addNotification(`Playing: ${episode.title}`, { level: 'success' })
  }

  const handleSeasonFocus = (season) => {
    setActiveSeasonId(season.id)
    onFocusItem(season)
  }

  return (
    <div style={styles.container}>
      <div style={styles.meta}>
        <div style={styles.metaItem}><span style={styles.metaLabel}>Studio:</span> {item.studio}</div>
        <div style={styles.metaItem}><span style={styles.metaLabel}>Genre:</span> {item.genres?.join(', ')}</div>
      </div>

      <ActionButtons onPlay={handlePlay} onMore={() => console.log('More info')} />

      {/* Row 1: Seasons */}
      {seasons.length > 0 && (
        <div style={styles.explorerSection} className="row">
          <h3 style={styles.header}>Seasons</h3>
          <div style={styles.scroller} className="hide-scrollbar row-items">
            {seasons.map((season, i) => (
              <FocusableItem
                key={season.id}
                id={`season-${season.id}`}
                rowIndex={1}
                colIndex={i}
                onFocus={() => handleSeasonFocus(season)}
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

      {/* Row 2: Episodes of Active Season */}
      <div style={styles.explorerSection} className="row">
        <h3 style={styles.header}>
          {seasons.find(s => s.id === activeSeasonId)?.title || 'Episodes'}
        </h3>
        {loadingEpisodes ? (
           <div style={styles.loadingPlaceholder}>Loading episodes...</div>
        ) : (
          <div style={styles.scroller} className="hide-scrollbar row-items">
            {episodes.map((episode, i) => (
              <FocusableItem
                key={episode.id}
                id={`episode-${episode.id}`}
                rowIndex={2}
                colIndex={i}
                onFocus={() => onFocusItem(episode)}
                onClick={() => handleEpisodeClick(episode)}
                className="episode-card"
              >
                <div style={styles.episodeInner}>
                  <FallbackImage src={episode.thumb} alt={episode.title} style={styles.episodeThumb} loading="lazy" />
                  <div style={styles.episodeMeta}>
                    <span style={styles.episodeNumber}>E{episode.index}</span> {episode.title}
                  </div>
                </div>
              </FocusableItem>
            ))}
            {episodes.length === 0 && !loadingEpisodes && (
              <div style={styles.noEpisodes}>No episodes found for this season.</div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .season-card, .episode-card {
          border-radius: 12px;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .season-card.focused, .episode-card.focused {
          transform: scale(1.05);
          z-index: 10;
        }
        .season-card.focused img, .episode-card.focused img,
        .season-card.focused .fallback-placeholder, .episode-card.focused .fallback-placeholder {
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
          border: 2px solid #fff;
        }
      `}</style>

      <div style={{ marginTop: '40px' }}>
        <CastScroller cast={item.actors} rowIndexOffset={3} onFocusItem={onFocusItem} />
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px'
  },
  meta: {
    display: 'flex',
    gap: '30px',
    marginBottom: '10px'
  },
  metaItem: {
    fontSize: '28px',
    color: '#ccc',
  },
  metaLabel: {
    fontWeight: '600',
    color: '#fff',
    marginRight: '8px',
  },
  explorerSection: {
    minWidth: 0,
  },
  header: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#aaa',
    marginBottom: '20px',
  },
  scroller: {
    display: 'flex',
    gap: '24px',
    overflowX: 'auto',
    padding: '20px 10px',
    margin: '-20px -10px',
  },
  seasonInner: {
    width: '180px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  seasonPoster: {
    width: '180px',
    height: '270px',
    borderRadius: '12px',
    objectFit: 'cover',
    backgroundColor: '#222',
    marginBottom: '12px',
    border: '2px solid transparent',
  },
  seasonTitle: {
    fontSize: '26px',
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  episodeInner: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
  },
  episodeThumb: {
    width: '320px',
    height: '180px',
    borderRadius: '12px',
    objectFit: 'cover',
    backgroundColor: '#222',
    marginBottom: '12px',
    border: '2px solid transparent',
  },
  episodeMeta: {
    fontSize: '26px',
    fontWeight: '500',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  episodeNumber: {
    color: '#aaa',
    fontWeight: '700',
    marginRight: '8px'
  },
  loadingPlaceholder: {
    fontSize: '24px',
    color: '#666',
    padding: '40px 0'
  },
  noEpisodes: {
    fontSize: '24px',
    color: '#666',
    padding: '20px 0'
  }
}

