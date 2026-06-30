import React, { useState, useEffect, useRef } from 'react';
import { FocusableItem } from '../navigational/FocusableItem';
import { FocusLayer } from '../../contexts/SpatialNavigationContext';
import { FiPlay } from 'react-icons/fi';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { MdOutlineKeyboardArrowRight, MdKeyboardArrowDown } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useServerManagerStore } from '../../stores/serverManagerStore';
import { buildImageUrl, getMetadata } from '../../services/plex/plexContentService';
import { useBrowserStore } from '../../stores/browserStore';

const getAccentColors = (title = '') => {
  const palettes = [
    { accent1: '#ff3b30', accent2: '#ff6b6b' }, // Deep Crimson
    { accent1: '#2ecc71', accent2: '#26e680' }, // Deep Emerald
    { accent1: '#00c2ff', accent2: '#007eff' }, // Nordic Midnight
    { accent1: '#bf5af2', accent2: '#e394fe' }, // Royal Amethyst
    { accent1: '#ffb300', accent2: '#ff8008' }, // Warm Amber
    { accent1: '#00d2c4', accent2: '#00a396' }  // Oceanic Teal
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

export function HeroBanner({ items = [] }) {
  const navigate = useNavigate();
  const currentIndex = useBrowserStore(state => state.heroIndex);
  const setCurrentIndex = useBrowserStore(state => state.setHeroIndex);
  const [userInteracted, setUserInteracted] = useState(0); // Store timestamp of last interaction
  const [showDescription, setShowDescription] = useState(false);
  const [showNoDescDialog, setShowNoDescDialog] = useState(false);
  const [fetchedSummary, setFetchedSummary] = useState('');

  const item = items[currentIndex];

  useEffect(() => {
    let active = true;
    const loadShowSummary = async () => {
      setFetchedSummary('');
      if (!item) return;

      // If it's a movie and has summary, use it immediately
      if (item.type === 'movie' && item.summary) {
        setFetchedSummary(item.summary);
        return;
      }

      // Resolve server info
      let serverUri = null;
      let token = null;
      if (item._serverContext?.clientId) {
        const s = useServerManagerStore.getState().servers[item._serverContext.clientId];
        if (s) {
          serverUri = s.uri;
          token = s.accessToken;
        }
      }

      if (!serverUri || !token) {
        setFetchedSummary(item.summary || '');
        return;
      }

      try {
        const showKey = item.type === 'episode'
          ? item.grandparentRatingKey
          : (item.type === 'season' ? item.parentRatingKey : item.id);

        if (showKey && item.type !== 'movie') {
          const meta = await getMetadata(serverUri, token, showKey);
          if (active) {
            setFetchedSummary(meta?.summary || item.summary || '');
          }
        } else {
          setFetchedSummary(item.summary || '');
        }
      } catch (err) {
        console.warn('[HeroBanner] Failed to fetch parent metadata:', err);
        if (active) {
          setFetchedSummary(item.summary || '');
        }
      }
    };

    loadShowSummary();
    return () => {
      active = false;
    };
  }, [item]);

  useEffect(() => {
    setShowDescription(false);
    setShowNoDescDialog(false);
  }, [currentIndex]);
  
  const timerRef = useRef(null);
  const goToNextSlideRef = useRef(null);

  useEffect(() => {
    if (items && items.length > 0) {
      // Bounds check: if the preserved index is out of bounds for the new items array, reset to 0
      if (currentIndex >= items.length) {
        setCurrentIndex(0);
      }

      console.log('--- Hero Banner Art Sources ---');
      items.forEach((it, idx) => {
        let artSource = 'None';
        if (it.rawArt) artSource = 'rawArt (art/grandparentArt/parentArt)';
        else if (it.rawThumb) artSource = 'rawThumb (poster)';
        console.log(`Slide ${idx + 1} (${it.title}): Using ${artSource}`);
      });
      console.log('-------------------------------');

      // Auto-focus play button on load
      const timer = setTimeout(() => {
        const playBtn = document.getElementById('hero-play-btn');
        if (playBtn && (!document.activeElement || document.activeElement === document.body || document.activeElement.id.startsWith('nav-'))) {
          playBtn.focus({ preventScroll: true });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [items, currentIndex, setCurrentIndex]);

  // Update the ref function on each render to close stale closures
  goToNextSlideRef.current = () => {
    if (showDescription) {
      setShowDescription(false);
      // Wait for the CSS fade-out opacity transition (250ms) before changing slides
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % items.length);
      }, 250);
    } else {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }
  };

  // Auto-advance logic (resumes after 5 seconds of user inactivity)
  useEffect(() => {
    if (!items || items.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const timeSinceInteraction = Date.now() - userInteracted;
    if (timeSinceInteraction < 5000) {
      // User interacted recently, wait for the remainder of the 5 seconds of inactivity
      const remainingTime = 5000 - timeSinceInteraction;
      const delayTimer = setTimeout(() => {
        setUserInteracted(0); // Trigger re-evaluation of auto-advance
      }, remainingTime);
      return () => clearTimeout(delayTimer);
    }

    timerRef.current = setInterval(() => {
      if (goToNextSlideRef.current) {
        goToNextSlideRef.current();
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items, userInteracted, items.length]);

  // Global keydown listener to stop timer on remote interaction
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Any navigation keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        setUserInteracted(Date.now());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!items || items.length === 0) return null;

  if (!item) return null;

  const title = item.type === 'episode' && item.grandparentTitle
    ? item.grandparentTitle
    : (item.type === 'season' && item.parentTitle ? item.parentTitle : (item.title || 'Unknown Title'));
  const year = item.year;
  const rating = item.contentRating;
  const duration = item.duration ? Math.round(item.duration / 60000) + ' min' : null;
  const summary = fetchedSummary || item.summary;

  const handlePlay = (e) => {
    if (e) e.stopPropagation();
    let targetServerInfo = null;
    if (item._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId];
      if (s) {
        targetServerInfo = { uri: s.uri, token: s.accessToken, owned: s.owned };
      }
    }
    const path = item.type === 'episode' || item.type === 'movie' ? `/play/${item.id}` : `/details/${item.id}`;
    navigate(path, { state: { serverInfo: targetServerInfo, item: item } });
  };

  const handleInfo = (e) => {
    if (e) e.stopPropagation();
    let targetServerInfo = null;
    if (item._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId];
      if (s) {
        targetServerInfo = { uri: s.uri, token: s.accessToken, owned: s.owned };
      }
    }
    navigate(`/details/${item.id}`, { state: { serverInfo: targetServerInfo, item: item } });
  };

  const handleToggleDescription = (e) => {
    if (e) e.stopPropagation();
    setUserInteracted(Date.now());
    if (summary) {
      setShowDescription(prev => !prev);
    } else {
      setShowNoDescDialog(true);
    }
  };

  const handleNextSlide = (e) => {
    if (e) e.stopPropagation();
    setUserInteracted(Date.now());
    if (goToNextSlideRef.current) {
      goToNextSlideRef.current();
    }
  };

  const handleFocus = () => {
    setUserInteracted(Date.now());
  };

  const colors = getAccentColors(title);
  const accentColor1 = colors.accent1;
  const accentColor2 = colors.accent2;

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      height: '100vh', // Full screen height
      padding: '0 50px 50px 45px', // Pushed to the very bottom
      color: '#fff',
      zIndex: 1,
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0 // Prevent squishing
    },
    bgImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'top center',
      zIndex: -2,
      opacity: 1,
      transition: 'opacity 0.8s ease-in-out',
      willChange: 'opacity'
    },
    title: {
      fontSize: '64px',
      fontWeight: '800',
      marginBottom: '10px',
      fontFamily: "'Outfit', sans-serif",
      letterSpacing: '-1px',
      textShadow: '0 3px 6px rgba(0, 0, 0, 0.9)',
      maxWidth: '100%',
      color: '#ffffff',
      animation: 'fadeInUp 0.5s ease-out forwards'
    },
    metaRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      fontSize: '18px',
      color: '#ccc',
      marginBottom: '20px',
      fontWeight: '500',
      animation: 'fadeInUp 0.6s ease-out forwards'
    },
    ratingBadge: {
      border: `1.5px solid ${accentColor1}`,
      color: accentColor1,
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 'bold'
    },
    summary: {
      fontSize: '28px',
      color: '#e0e0e0',
      maxWidth: '850px',
      lineHeight: '1.5',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.9)',
      opacity: showDescription ? 1 : 0,
      visibility: showDescription ? 'visible' : 'hidden',
      transition: 'opacity 0.25s ease, visibility 0.25s ease',
      animation: 'fadeInUp 0.7s ease-out forwards'
    },
    contentRow: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      width: '100%',
      marginBottom: '10px'
    },
    leftColumn: {
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '55%',
      flexShrink: 0
    },
    rightColumn: {
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '40%',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      textAlign: 'right'
    },
    actions: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
    },
    bottomBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: '10px',
      animation: 'fadeInUp 0.8s ease-out forwards'
    },
    rightGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '40px'
    },
    dotsContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    dot: (distance, isActive) => {
      let width, height, opacity, margin, scale;

      if (distance === 0) {
        width = '24px';
        height = '8px';
        opacity = 1;
        margin = '0 5px';
        scale = 1;
      } else if (distance <= 2) {
        width = '8px';
        height = '8px';
        opacity = 0.6;
        margin = '0 5px';
        scale = 1;
      } else if (distance === 3) {
        width = '8px';
        height = '8px';
        opacity = 0.3;
        margin = '0 5px';
        scale = 0.6;
      } else {
        width = '0px';
        height = '8px';
        opacity = 0;
        margin = '0 0px';
        scale = 0;
      }

      return {
        width,
        height,
        opacity,
        margin,
        transform: `scale(${scale})`,
        borderRadius: '4px',
        backgroundColor: isActive ? '#fff' : 'rgba(255,255,255,1)',
        transition: 'all 0.3s ease'
      };
    },
    fadeContainer: {
      key: currentIndex, // Forcing React to remount/reanimate on index change
      display: 'flex',
      flexDirection: 'column'
    },
    exitOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    exitModal: {
      backgroundColor: 'rgba(20, 20, 26, 0.95)',
      border: '1.5px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '9999px',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
      padding: '0 45px',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '60px',
      height: '100px',
      width: 'auto',
      minWidth: '820px',
      marginBottom: '25vh',
    },
    exitTitle: {
      fontSize: '32px',
      fontWeight: '600',
      color: '#ffffff',
      margin: 0,
      fontFamily: "'Outfit', 'Inter', sans-serif",
      letterSpacing: '-0.3px',
    },
    exitButtonRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '20px',
    }
  };

  return (
    <div 
      style={{...styles.container, cursor: 'pointer'}} 
      onClick={handleInfo}
    >
      {/* Background with crossfade key mapping */}
      {items.map((it, idx) => {
        let bgUrl = null;
        const art = it.rawArt || it.rawThumb;
        if (art) {
          if (it._serverContext?.clientId) {
            const s = useServerManagerStore.getState().servers[it._serverContext.clientId];
            if (s && s.uri && s.accessToken) {
              bgUrl = buildImageUrl(s.uri, art, s.accessToken, 1920, 1080);
            }
          } else {
            bgUrl = art;
          }
        }
        
        return (
          <img 
            key={it.id}
            src={bgUrl} 
            style={{
              ...styles.bgImage,
              opacity: currentIndex === idx ? 1 : 0,
              visibility: currentIndex === idx ? 'visible' : 'hidden'
            }} 
            alt="" 
          />
        );
      })}

      <div key={item.id} style={{ ...styles.fadeContainer, width: '100%' }}>
        <div style={styles.contentRow}>
          {/* Left Column: Logo/Title and Rating */}
          <div style={styles.leftColumn}>
            {item.logo ? (
              <img src={item.logo} alt={title} style={{ maxWidth: '400px', maxHeight: '120px', objectFit: 'contain', marginBottom: '20px' }} />
            ) : (
              <h1 style={styles.title}>{title}</h1>
            )}
            {rating && (
              <div style={styles.metaRow}>
                <span style={styles.ratingBadge}>{rating}</span>
              </div>
            )}
          </div>

          {/* Right Column: Description Summary */}
          <div style={styles.rightColumn}>
            {summary && <p style={styles.summary}>{summary}</p>}
          </div>
        </div>
      </div>
      <div style={styles.bottomBar}>
        <div style={styles.actions}>
          <FocusableItem 
            id="hero-play-btn" 
            onClick={handlePlay}
            onFocus={handleFocus}
          >
            <div className="capsule-btn" style={{ padding: '20px 48px', fontSize: '26px' }}>
              <FiPlay style={{ marginRight: '10px' }} /> Play
            </div>
          </FocusableItem>

          <FocusableItem 
            id="hero-info-btn" 
            onClick={handleToggleDescription}
            onFocus={handleFocus}
          >
            <div className="capsule-btn" style={{ width: '72px', height: '72px', padding: 0, justifyContent: 'center', borderRadius: '50%' }}>
              <IoInformationCircleOutline size={34} />
            </div>
          </FocusableItem>

          <FocusableItem 
            id="hero-next-btn" 
            onClick={handleNextSlide}
            onFocus={handleFocus}
          >
            <div className="capsule-btn" style={{ width: '72px', height: '72px', padding: 0, justifyContent: 'center', borderRadius: '50%' }}>
              <MdOutlineKeyboardArrowRight size={34} />
            </div>
          </FocusableItem>
        </div>

        <div style={styles.rightGroup}>
          <div style={styles.dotsContainer}>
            {items.map((_, idx) => {
              // Calculate shortest circular distance
              const d = Math.abs(idx - currentIndex);
              const distance = Math.min(d, items.length - d);
              return <div key={idx} style={styles.dot(distance, idx === currentIndex)} />;
            })}
          </div>
          
          <MdKeyboardArrowDown className="scroll-down-arrow" size={48} />
        </div>
      </div>

      {showNoDescDialog && (
        <FocusLayer id="no-desc-dialog" isActive={true}>
          <div 
            style={styles.exitOverlay} 
            className="exit-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.exitModal} className="exit-modal">
              <span style={styles.exitTitle}>no description available for this content yet.</span>
              <div style={styles.exitButtonRow}>
                <FocusableItem
                  id="no-desc-close"
                  rowIndex={999}
                  colIndex={0}
                  onClick={(e) => {
                    if (e) e.stopPropagation();
                    setShowNoDescDialog(false);
                  }}
                  className="exit-btn cancel"
                >
                  Close
                </FocusableItem>
              </div>
            </div>
          </div>
        </FocusLayer>
      )}
    </div>
  );
}
