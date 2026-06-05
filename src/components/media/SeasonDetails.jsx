import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../navigational/FocusableItem'
import { formatDuration } from '../../services/plex/plexContentService'
import { useToggleWatched } from '../../hooks/useToggleWatched'
import { useEpisodes } from '../../hooks/useEpisodes'
import { FallbackImage } from './FallbackImage'
import ActionButtons from './ActionButtons'
import { useBrowserStore } from '../../stores/browserStore'
import { FiPlay, FiRefreshCw, FiCheck, FiX } from 'react-icons/fi'

export default function SeasonDetails({ item, serverInfo, onFocusItem }) {
  const navigate = useNavigate()
  const showUnwatchedIndicator = useBrowserStore((state) => state.showUnwatchedIndicator)
  
  const [episodes, setEpisodes, loadingEpisodes] = useEpisodes(serverInfo, item.id)
  const toggleWatched = useToggleWatched(serverInfo)

  const handlePlay = () => {
    console.log('Play season:', item.id)
    if (episodes && episodes.length > 0) {
      navigate(`/play/${episodes[0].id}`, { state: { serverInfo } })
    }
  }

  const handleEpisodeClick = (episodeId) => {
    navigate(`/details/${episodeId}`, { state: { serverInfo } })
  }

  const handleToggleWatched = async (episode) => {
    const newWatchedState = await toggleWatched(episode)
    if (newWatchedState !== null) {
      const viewCount = newWatchedState ? 1 : 0
      
      // Update episodes local state instantly
      setEpisodes(prev => prev.map(ep => 
        ep.id === episode.id ? { ...ep, viewCount } : ep
      ))
    }
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
                  <div style={styles.episodeThumbContainer} className="episode-thumb-container">
                    <FallbackImage src={episode.thumb} itemId={episode.ratingKey} alt={episode.title} style={styles.episodeThumb} loading="lazy" />
                    
                    <div 
                      className="episode-play-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/play/${episode.id}`, { state: { serverInfo } })
                      }}
                    >
                      <FiPlay size={18} color="#000000" fill="#000000" />
                    </div>

                    {episode.viewOffset > 0 && (
                      <div 
                        className="episode-rewind-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/play/${episode.id}`, { state: { serverInfo, startOver: true } })
                        }}
                      >
                        <FiRefreshCw size={16} color="#ffffff" strokeWidth={2.5} />
                      </div>
                    )}

                    {showUnwatchedIndicator && (
                      Number(episode.viewCount || 0) > 0 ? (
                        <div 
                          style={styles.watchedRibbon} 
                          className="watched-ribbon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleWatched(episode)
                          }}
                        >
                          {/* Tick checkmark (Shown by default) */}
                          <FiCheck size={24} className="watched-tick" color="#fff" strokeWidth={4.5} style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }} />
                          {/* Cross X (Shown on hover) */}
                          <FiX size={24} className="watched-cross" color="#fff" strokeWidth={4.5} style={{ display: 'none', transform: 'rotate(-45deg)', marginBottom: '6px' }} />
                        </div>
                      ) : (
                        <div 
                          style={styles.unwatchedEpisodeRibbon} 
                          className="unwatched-episode-ribbon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleWatched(episode)
                          }}
                        >
                          {/* Tick checkmark (Shown on hover/cursor) */}
                          <FiCheck size={24} className="unwatched-tick" color="#fff" strokeWidth={4.5} style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }} />
                        </div>
                      )
                    )}
                  </div>
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
          scroll-margin-left: 10px;
        }
        .episode-card.focused {
          transform: scale(1.05);
          z-index: 10;
        }
        .episode-card.focused .episode-thumb-container {
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
          border: 2px solid #fff;
        }
        .episode-play-button {
          position: absolute;
          bottom: 12px;
          left: 12px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(8px) scale(0.9);
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 6;
        }
        .episode-card.focused .episode-play-button {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .episode-rewind-button {
          position: absolute;
          bottom: 12px;
          left: 56px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: rgba(0, 0, 0, 0.65);
          border: 1.5px solid rgba(255, 255, 255, 0.35);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(8px) scale(0.9);
          transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
          z-index: 7;
        }
        .episode-rewind-button:hover {
          background-color: rgba(255, 255, 255, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.95) !important;
        }
        .episode-rewind-button:hover svg {
          stroke: #000000 !important;
        }
        .episode-card.focused .episode-rewind-button {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .watched-ribbon {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
        }
        .watched-ribbon:hover {
          background-color: rgba(255, 115, 0, 0.8) !important;
          border-color: rgba(255, 115, 0, 0.95) !important;
          cursor: pointer;
          transform: rotate(45deg) scale(1.05) !important;
        }
        .watched-ribbon:hover .watched-tick {
          display: none !important;
        }
        .watched-ribbon:hover .watched-cross {
          display: block !important;
        }
        .unwatched-episode-ribbon {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
        }
        .unwatched-episode-ribbon:hover {
          background-color: rgba(140, 140, 140, 0.75) !important;
          border-color: rgba(255, 255, 255, 0.9) !important;
          cursor: pointer;
          transform: rotate(45deg) scale(1.05) !important;
        }
        .unwatched-episode-ribbon .unwatched-tick {
          display: none !important;
        }
        .unwatched-episode-ribbon:hover .unwatched-tick {
          display: block !important;
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
    scrollBehavior: 'smooth',
  },
  episodeInner: {
    width: '280px',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
  },
  episodeThumbContainer: {
    position: 'relative',
    width: '280px',
    height: '158px', // 16:9 aspect ratio
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#222',
    marginBottom: '12px',
    boxSizing: 'border-box',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  episodeThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  watchedRibbon: {
    position: 'absolute',
    top: '-70px',
    right: '-70px',
    width: '140px',
    height: '140px',
    backgroundColor: 'rgba(229, 160, 13, 0.45)',
    border: '1.5px solid rgba(229, 160, 13, 0.6)',
    transform: 'rotate(45deg)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  unwatchedEpisodeRibbon: {
    position: 'absolute',
    top: '-70px',
    right: '-70px',
    width: '140px',
    height: '140px',
    backgroundColor: 'rgba(90, 90, 90, 0.45)',
    border: '1.5px solid rgba(150, 150, 150, 0.6)',
    transform: 'rotate(45deg)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
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
