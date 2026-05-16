import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../navigational/FocusableItem'
import { getChildren, formatDuration } from '../../services/plex/plexContentService'
import { FallbackImage } from './FallbackImage'
import ActionButtons from './ActionButtons'

export default function SeasonDetails({ item, serverInfo, onFocusItem }) {
  const navigate = useNavigate()
  
  const [episodes, setEpisodes] = useState([])

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        if (!serverInfo?.uri || !serverInfo?.token || !item.id) return
        const children = await getChildren(serverInfo.uri, serverInfo.token, item.id)
        setEpisodes(children)
      } catch (err) {
        console.error('Failed to fetch episodes:', err)
      }
    }
    fetchEpisodes()
  }, [item.id, serverInfo])

  const handlePlay = () => {
    console.log('Play season:', item.id)
  }

  const handleEpisodeClick = (episodeId) => {
    navigate(`/details/${episodeId}`, { state: { serverInfo } })
  }

  return (
    <div style={styles.container}>
      <ActionButtons 
        onPlay={handlePlay} 
        onFocus={() => onFocusItem(null)} 
      />

      {episodes.length > 0 && (
        <div style={styles.episodesContainer} className="row">
          <h3 style={styles.header}>Episodes</h3>
          <div style={styles.scroller} className="hide-scrollbar row-items">
            {episodes.map((episode, i) => (
              <FocusableItem
                key={episode.id}
                id={`episode-${episode.id}`}
                rowIndex={1}
                colIndex={i}
                onClick={() => handleEpisodeClick(episode.id)}
                onFocus={() => onFocusItem(episode)}
                className="episode-card"
              >
                <div style={styles.episodeInner}>
                  <FallbackImage src={episode.thumb} alt={episode.title} style={styles.episodeThumb} loading="lazy" />
                  <div style={styles.episodeMeta}>
                    <span style={styles.episodeNumber}>{episode.index}.</span> {episode.title}
                  </div>
                </div>
              </FocusableItem>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .episode-card {
          border-radius: 12px;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .episode-card.focused {
          transform: scale(1.05);
          z-index: 10;
        }
        .episode-card.focused img, .episode-card.focused .fallback-placeholder {
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
          border: 2px solid #fff;
        }
      `}</style>
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
  },
  episodesContainer: {
    marginTop: '30px',
    minWidth: 0,
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
    paddingLeft: '10px',
    marginLeft: '-10px',
    marginTop: '-30px', // Compensate for padding
  },
  episodeInner: {
    width: '280px',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
  },
  episodeThumb: {
    width: '280px',
    height: '158px', // 16:9 aspect ratio
    borderRadius: '12px',
    objectFit: 'cover',
    backgroundColor: '#222',
    marginBottom: '12px',
    boxSizing: 'border-box',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  episodeMeta: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#fff',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  episodeNumber: {
    color: '#aaa',
    fontWeight: '600',
  }
}
