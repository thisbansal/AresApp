import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButtons from './ActionButtons'
import { FocusableItem } from '../navigational/FocusableItem'
import { getChildren } from '../../services/plex/plexContentService'
import { useToggleWatched } from '../../hooks/useToggleWatched'
import { useEpisodes } from '../../hooks/useEpisodes'
import { FallbackImage } from './FallbackImage'
import { findTargetSeason } from '../../utils/seasonSelector'
import { useBrowserStore } from '../../stores/browserStore'
import { FiChevronDown, FiCheck, FiX } from 'react-icons/fi'

export default function ShowDetails({ item, serverInfo, contextItem, onFocusItem, onRegisterPlay }) {
  const navigate = useNavigate()
  const showUnwatchedIndicator = useBrowserStore((state) => state.showUnwatchedIndicator)
  const [seasons, setSeasons] = useState([])
  const [activeSeasonId, setActiveSeasonId] = useState(null)
  const [episodes, setEpisodes, loadingEpisodes] = useEpisodes(serverInfo, activeSeasonId)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const toggleWatched = useToggleWatched(serverInfo)

  const dropdownRef = React.useRef(null)

  // 2. Click outside listener to collapse dropdown
  useEffect(() => {
    if (!isDropdownOpen) return

    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('click', handleOutsideClick)
    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [isDropdownOpen])

  // 3. D-Pad / Focus loss listener to collapse dropdown when navigating away
  useEffect(() => {
    if (!isDropdownOpen) return

    const handleFocusIn = (e) => {
      const activeEl = e.target;
      if (activeEl && activeEl.id !== 'season-dropdown-btn' && !(activeEl.id && activeEl.id.startsWith('season-option-'))) {
        setIsDropdownOpen(false)
      }
    }

    window.addEventListener('focusin', handleFocusIn)
    return () => {
      window.removeEventListener('focusin', handleFocusIn)
    }
  }, [isDropdownOpen])

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
          let targetSeason = null
          
          if (contextItem) {
            if (contextItem.type === 'season') {
              targetSeason = children.find(s => String(s.id) === String(contextItem.id) || (s.ratingKey && contextItem.ratingKey && String(s.ratingKey) === String(contextItem.ratingKey)))
            } else if (contextItem.type === 'episode' && contextItem.parentRatingKey) {
              targetSeason = children.find(s => String(s.id) === String(contextItem.parentRatingKey) || (s.ratingKey && String(s.ratingKey) === String(contextItem.parentRatingKey)))
            }
          }
          
          if (!targetSeason) {
            targetSeason = findTargetSeason(children)
          }
          
          // Fallback to first available season if target isn't found
          if (!targetSeason) {
            targetSeason = children[0]
          }
          
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



  const handlePlay = () => {
    if (episodes.length > 0) {
      handleEpisodeClick(episodes[0])
    }
  }

  useEffect(() => {
    if (onRegisterPlay) {
      onRegisterPlay(handlePlay)
    }
    return () => {
      if (onRegisterPlay) {
        onRegisterPlay(null)
      }
    }
  }, [episodes, onRegisterPlay])

  const handleEpisodeClick = (episode) => {
    console.log('Play episode:', episode.title)
    navigate(`/play/${episode.id}`, { state: { serverInfo } })
  }

  const handleToggleWatched = async (episode) => {
    const isWatched = Number(episode.viewCount || 0) > 0
    const targetWatchedState = !isWatched

    // 1. Optimistic update episodes local state instantly
    setEpisodes(prev => prev.map(ep => 
      ep.id === episode.id ? { ...ep, viewCount: targetWatchedState ? 1 : 0 } : ep
    ))
    
    // 2. Optimistic update viewedLeafCount in seasons state
    setSeasons(prev => prev.map(s => {
      if (s.id === activeSeasonId) {
        const currentViewed = Number(s.viewedLeafCount || 0)
        const leafCount = Number(s.leafCount || 0)
        return {
          ...s,
          viewedLeafCount: targetWatchedState
            ? Math.min(leafCount, currentViewed + 1)
            : Math.max(0, currentViewed - 1)
        }
      }
      return s
    }))

    const newWatchedState = await toggleWatched(episode)
    if (newWatchedState === null) {
      // Revert if failed
      setEpisodes(prev => prev.map(ep => 
        ep.id === episode.id ? { ...ep, viewCount: isWatched ? 1 : 0 } : ep
      ))
      setSeasons(prev => prev.map(s => {
        if (s.id === activeSeasonId) {
          const currentViewed = Number(s.viewedLeafCount || 0)
          const leafCount = Number(s.leafCount || 0)
          return {
            ...s,
            viewedLeafCount: isWatched
              ? Math.min(leafCount, currentViewed + 1)
              : Math.max(0, currentViewed - 1)
          }
        }
        return s
      }))
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
      {/* Row 1: Season Dropdown / Label */}
      {seasons.length > 0 && (
        <div style={styles.dropdownContainer} className="row">
          {hasDropdown ? (
            <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', width: '320px' }}>
              <FocusableItem
                id="season-dropdown-btn"
                rowIndex={1}
                colIndex={1}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`season-dropdown-btn ${isDropdownOpen ? 'dropdown-open' : ''}`}
                style={{
                  width: '320px',
                  ...(isDropdownOpen ? {
                    borderBottomLeftRadius: '0px',
                    borderBottomRightRadius: '0px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                  } : {
                    borderBottomLeftRadius: '16px',
                    borderBottomRightRadius: '16px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                  })
                }}
              >
                <div style={{
                  ...styles.dropdownBtn,
                  ...(isDropdownOpen ? {
                    borderBottomLeftRadius: '0px',
                    borderBottomRightRadius: '0px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    borderBottomColor: 'transparent',
                  } : {
                    borderBottomLeftRadius: '16px',
                    borderBottomRightRadius: '16px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
                  })
                }}>
                  <span>{seasons.find(s => s.id === activeSeasonId)?.title || 'Select Season'}</span>
                  <FiChevronDown 
                    size={24} 
                    style={{ marginLeft: '16px', transition: 'transform 0.2s ease', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} 
                  />
                </div>
              </FocusableItem>

              {/* Dropdown Options (Glassmorphic Vertical Menu) */}
              {isDropdownOpen && (
                <div style={{
                  ...styles.dropdownMenu,
                  borderTopLeftRadius: '0px',
                  borderTopRightRadius: '0px',
                  borderTopColor: 'transparent',
                }} className="hide-scrollbar">
                  {seasons.map((season, index) => (
                    <FocusableItem
                      key={season.id}
                      id={`season-option-${season.id}`}
                      rowIndex={2 + index}
                      colIndex={1}
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
                      <FallbackImage src={episode.thumb} itemId={episode.ratingKey} alt={episode.title} style={styles.episodeThumb} loading="lazy" />
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
                            <FiCheck size={24} className="watched-tick" color="#fff" strokeWidth={4} style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }} />
                            {/* Cross X (Shown on hover) */}
                            <FiX size={24} className="watched-cross" color="#fff" strokeWidth={4} style={{ display: 'none', transform: 'rotate(-45deg)', marginBottom: '6px' }} />
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
                            <FiCheck size={24} className="unwatched-tick" color="#fff" strokeWidth={4} style={{ transform: 'rotate(-45deg)', marginBottom: '6px' }} />
                          </div>
                        )
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
          border-radius: 16px;
          transition: transform 0.2s ease;
        }
        .season-dropdown-btn.dropdown-open {
          border-bottom-left-radius: 0px !important;
          border-bottom-right-radius: 0px !important;
          border-top-left-radius: 16px !important;
          border-top-right-radius: 16px !important;
          transform: none !important;
          transition: none !important;
        }
        .season-dropdown-btn.focused:not(.dropdown-open) {
          transform: scale(1.05) translate3d(0, 0, 0) !important;
        }
        .season-dropdown-btn.focused > div {
          background-color: rgba(255, 255, 255, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
        .season-dropdown-item {
          transition: transform 0.1s ease;
          will-change: transform;
          transform: translate3d(0, 0, 0);
        }
        .season-dropdown-item.focused {
          transform: scale(1.02) translate3d(0, 0, 0) !important;
        }
        .season-dropdown-item.focused > div {
          background-color: rgba(255, 255, 255, 0.2) !important;
        }
        .episode-card {
          border-radius: 12px;
          transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
          transform: translate3d(0, 0, 0);
        }
        .episode-card.focused {
          transform: scale(1.05) translate3d(0, 0, 0) !important;
          z-index: 10;
        }
        .episode-card.focused .episode-thumb-container {
          border-color: #fff !important;
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
    backgroundColor: 'rgba(25, 25, 30, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    width: '320px',
    transition: 'background-color 0.1s ease, border-color 0.1s ease',
    boxSizing: 'border-box',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: 'rgba(25, 25, 30, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
    width: '320px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 999,
    padding: '8px 0',
    boxSizing: 'border-box',
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


