import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'
import { FocusableItem } from '../navigational/FocusableItem'
import { getChildren, markAsUnwatched, markAsWatched } from '../../services/plex/plexContentService'
import { FallbackImage } from './FallbackImage'
import { useNotificationStore } from '../../services/notifications/notificationStore'
import { findTargetSeason } from '../../utils/seasonSelector'

export default function ShowDetails({ item, serverInfo, onFocusItem }) {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState([])
  const [activeSeasonId, setActiveSeasonId] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // 1. Fetch Seasons
  useEffect(() => {
    setSeasons([])
    setActiveSeasonId(null)
    setIsDropdownOpen(false)

    const fetchSeasons = async () => {
      try {
        if (!serverInfo?.uri || !serverInfo?.token || !item.id) return
        const children = await getChildren(serverInfo.uri, serverInfo.token, item.id)
        setSeasons(children)
        
        // Find the next active season using the multi-phase selection algorithm
        if (children.length > 0) {
          const targetSeason = findTargetSeason(children)
          if (targetSeason) {
            setActiveSeasonId(targetSeason.id)
          }
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
    if (episodes.length > 0) {
      handleEpisodeClick(episodes[0])
    }
  }

  const handleEpisodeClick = (episode) => {
    console.log('Play episode:', episode.title)
    useNotificationStore.getState().addNotification(`Playing: ${episode.title}`, { level: 'success' })
  }

  const handleToggleWatched = async (episode) => {
    try {
      if (!serverInfo?.uri || !serverInfo?.token) return
      
      const isCurrentlyWatched = Number(episode.viewCount || 0) > 0
      
      if (isCurrentlyWatched) {
        // Mark as Unwatched
        await markAsUnwatched(serverInfo.uri, serverInfo.token, episode.id)
        
        // 1. Update episodes local state instantly
        setEpisodes(prev => prev.map(ep => 
          ep.id === episode.id ? { ...ep, viewCount: 0 } : ep
        ))
        
        // 2. Decrement viewedLeafCount in seasons state
        setSeasons(prev => prev.map(s => {
          if (s.id === activeSeasonId) {
            const currentViewed = Number(s.viewedLeafCount || 0)
            return {
              ...s,
              viewedLeafCount: Math.max(0, currentViewed - 1)
            }
          }
          return s
        }))
        
        useNotificationStore.getState().addNotification(`Marked as unwatched: ${episode.title}`, { level: 'success' })
      } else {
        // Mark as Watched
        await markAsWatched(serverInfo.uri, serverInfo.token, episode.id)
        
        // 1. Update episodes local state instantly
        setEpisodes(prev => prev.map(ep => 
          ep.id === episode.id ? { ...ep, viewCount: 1 } : ep
        ))
        
        // 2. Increment viewedLeafCount in seasons state
        setSeasons(prev => prev.map(s => {
          if (s.id === activeSeasonId) {
            const currentViewed = Number(s.viewedLeafCount || 0)
            const leafCount = Number(s.leafCount || 0)
            return {
              ...s,
              viewedLeafCount: Math.min(leafCount, currentViewed + 1)
            }
          }
          return s
        }))
        
        useNotificationStore.getState().addNotification(`Marked as watched: ${episode.title}`, { level: 'success' })
      }
    } catch (err) {
      console.error('Failed to toggle watched state:', err)
    }
  }

  const handleSeasonSelect = (season) => {
    setActiveSeasonId(season.id)
    onFocusItem(season)
    setIsDropdownOpen(false)
  }

  const hasDropdown = seasons.length > 1
  const baseRowIndex = hasDropdown ? (isDropdownOpen ? (2 + seasons.length) : 2) : 1
  const EPISODES_PER_ROW = 4

  return (
    <div style={styles.container}>
      <div style={styles.meta}>
        <div style={styles.metaItem}><span style={styles.metaLabel}>Studio:</span> {item.studio}</div>
        <div style={styles.metaItem}><span style={styles.metaLabel}>Genre:</span> {item.genres?.join(', ')}</div>
      </div>

      <ActionButtons onPlay={handlePlay} onMore={() => console.log('More info')} />

      {/* Row 1: Season Dropdown / Label */}
      {seasons.length > 0 && (
        <div style={styles.dropdownContainer} className="row">
          {hasDropdown ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <FocusableItem
                id="season-dropdown-btn"
                rowIndex={1}
                colIndex={0}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="season-dropdown-btn"
              >
                <div style={styles.dropdownBtn}>
                  <span>{seasons.find(s => s.id === activeSeasonId)?.title || 'Select Season'}</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '16px', transition: 'transform 0.2s ease', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </FocusableItem>

              {/* Dropdown Options (Glassmorphic Vertical Menu) */}
              {isDropdownOpen && (
                <div style={styles.dropdownMenu} className="hide-scrollbar">
                  {seasons.map((season, index) => (
                    <FocusableItem
                      key={season.id}
                      id={`season-option-${season.id}`}
                      rowIndex={2 + index}
                      colIndex={0}
                      onClick={() => handleSeasonSelect(season)}
                      className="season-dropdown-item"
                    >
                      <div style={{
                        ...styles.dropdownItem,
                        backgroundColor: activeSeasonId === season.id ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                        fontWeight: activeSeasonId === season.id ? '700' : '500',
                      }}>
                        {season.title}
                      </div>
                    </FocusableItem>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.singleSeasonLabel}>
              {seasons[0].title}
            </div>
          )}
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
          <div style={styles.grid}>
            {episodes.map((episode, i) => {
              const rowIndex = baseRowIndex + Math.floor(i / EPISODES_PER_ROW)
              const colIndex = i % EPISODES_PER_ROW
              return (
                <FocusableItem
                  key={episode.id}
                  id={`episode-${episode.id}`}
                  rowIndex={rowIndex}
                  colIndex={colIndex}
                  onFocus={() => onFocusItem(episode)}
                  onClick={() => handleEpisodeClick(episode)}
                  className="episode-card"
                >
                  <div style={styles.episodeInner}>
                    <div style={styles.episodeThumbContainer} className="episode-thumb-container">
                      <FallbackImage src={episode.thumb} alt={episode.title} style={styles.episodeThumb} loading="lazy" />
                      {Number(episode.viewCount || 0) > 0 && (
                        <div 
                          style={styles.watchedRibbon} 
                          className="watched-ribbon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleWatched(episode)
                          }}
                        >
                          {/* Tick checkmark (Shown by default) */}
                          <svg className="watched-tick" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }}>
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          {/* Cross X (Shown on hover) */}
                          <svg className="watched-cross" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none', transform: 'rotate(-45deg)', marginBottom: '6px' }}>
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div style={styles.episodeMeta}>
                      <span style={styles.episodeNumber}>E{episode.index}</span> {episode.title}
                    </div>
                  </div>
                </FocusableItem>
              )
            })}
            {episodes.length === 0 && !loadingEpisodes && (
              <div style={styles.noEpisodes}>No episodes found for this season.</div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .season-dropdown-btn {
          border-radius: 9999px;
          transition: transform 0.2s ease;
        }
        .season-dropdown-btn.focused {
          transform: scale(1.05) !important;
        }
        .season-dropdown-btn.focused > div {
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
        .season-dropdown-item {
          transition: transform 0.2s ease;
        }
        .season-dropdown-item.focused {
          transform: scale(1.02) !important;
        }
        .season-dropdown-item.focused > div {
          background-color: rgba(255, 255, 255, 0.2) !important;
        }
        .episode-card {
          border-radius: 12px;
          transition: transform 0.2s ease;
        }
        .episode-card.focused {
          transform: scale(1.05);
          z-index: 10;
        }
        .episode-card.focused .episode-thumb-container {
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.25) !important;
          border-color: #fff !important;
        }
        .watched-ribbon {
          transition: background-color 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
        }
        .watched-ribbon:hover {
          background-color: rgba(255, 59, 48, 0.8) !important;
          border-color: rgba(255, 59, 48, 0.95) !important;
          cursor: pointer;
          transform: rotate(45deg) scale(1.05) !important;
        }
        .watched-ribbon:hover .watched-tick {
          display: none !important;
        }
        .watched-ribbon:hover .watched-cross {
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
    gap: '40px',
    width: '100%',
    minWidth: 0,
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
    width: '100%',
  },
  header: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#aaa',
    marginBottom: '20px',
  },
  dropdownContainer: {
    marginBottom: '10px',
    zIndex: 100,
  },
  singleSeasonLabel: {
    display: 'inline-block',
    padding: '14px 28px',
    fontSize: '28px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '9999px',
    minWidth: '200px',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  dropdownBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 28px',
    fontSize: '28px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '9999px',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    minWidth: '280px',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    left: 0,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
    minWidth: '280px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 999,
    padding: '8px 0',
  },
  dropdownItem: {
    padding: '14px 28px',
    fontSize: '26px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    textAlign: 'left',
    borderRadius: '8px',
    margin: '4px 8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '24px',
    padding: '10px 0',
    width: '100%',
  },
  episodeInner: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  episodeThumbContainer: {
    position: 'relative',
    width: '100%',
    height: '180px',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#222',
    border: '2px solid transparent',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
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
    backgroundColor: 'rgba(0, 209, 102, 0.45)',
    border: '1.5px solid rgba(0, 209, 102, 0.6)',
    transform: 'rotate(45deg)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
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


