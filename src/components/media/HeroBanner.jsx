import React, { useState, useEffect, useRef } from 'react';
import { FocusableItem } from '../navigational/FocusableItem';
import { FocusLayer } from '../../contexts/SpatialNavigationContext';
import { FiPlay } from 'react-icons/fi';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { MdOutlineKeyboardArrowRight, MdKeyboardArrowDown } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useServerManagerStore } from '../../stores/serverManagerStore';
import { buildImageUrl } from '../../services/plex/plexContentService';
import { useBrowserStore } from '../../stores/browserStore';

export function HeroBanner({ items = [] }) {
  const navigate = useNavigate();
  const currentIndex = useBrowserStore(state => state.heroIndex);
  const setCurrentIndex = useBrowserStore(state => state.setHeroIndex);
  const [userInteracted, setUserInteracted] = useState(0); // Store timestamp of last interaction
  const [showDescription, setShowDescription] = useState(false);
  const [showNoDescDialog, setShowNoDescDialog] = useState(false);
  const [plexColors, setPlexColors] = useState(['#ffffff', '#ffffff', '#ffffff', '#ffffff']);

  useEffect(() => {
    setShowDescription(false);
    setShowNoDescDialog(false);
  }, [currentIndex]);

  // Fetch UltraBlur colors for the active image from Plex Server
  useEffect(() => {
    if (!items || items.length === 0) return;
    const currentItem = items[currentIndex];
    if (!currentItem) return;

    const art = currentItem.rawArt || currentItem.rawThumb;
    if (!art) {
      setPlexColors(['#ffffff', '#ffffff', '#ffffff', '#ffffff']);
      return;
    }

    let clientId = currentItem._serverContext?.clientId;
    if (!clientId) {
      setPlexColors(['#ffffff', '#ffffff', '#ffffff', '#ffffff']);
      return;
    }

    const s = useServerManagerStore.getState().servers[clientId];
    if (!s || !s.uri || !s.accessToken) {
      setPlexColors(['#ffffff', '#ffffff', '#ffffff', '#ffffff']);
      return;
    }

    const colorsUrl = `${s.uri}/photo/:/ultrablur/colors?url=${encodeURIComponent(art)}&X-Plex-Token=${s.accessToken}`;

    let active = true;
    fetch(colorsUrl, { headers: { 'Accept': 'application/json' } })
      .then(res => res.json())
      .then(data => {
        if (active && data && data.colors && Array.isArray(data.colors) && data.colors.length >= 4) {
          setPlexColors(data.colors);
        }
      })
      .catch(err => {
        console.error('[HeroBanner] Failed to fetch UltraBlur colors:', err);
        if (active) {
          setPlexColors(['#ffffff', '#ffffff', '#ffffff', '#ffffff']);
        }
      });

    return () => {
      active = false;
    };
  }, [currentIndex, items]);
  
  const timerRef = useRef(null);

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
      setCurrentIndex(prev => (prev + 1) % items.length);
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

  const item = items[currentIndex];
  if (!item) return null;

  const title = item.title || 'Unknown Title';
  const year = item.year;
  const rating = item.contentRating;
  const duration = item.duration ? Math.round(item.duration / 60000) + ' min' : null;
  const summary = item.summary;

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
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const handleFocus = () => {
    setUserInteracted(Date.now());
  };

  const accentColor1 = plexColors[3] || '#a5c7f7';
  const accentColor2 = plexColors[2] || '#a5c7f7';

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
      textShadow: '0 4px 12px rgba(0,0,0,0.5)',
      maxWidth: '80%',
      background: `linear-gradient(135deg, #ffffff 30%, ${accentColor1} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      transform: showDescription ? 'translateY(-20px)' : 'translateY(0)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
      transform: showDescription ? 'translateY(-20px)' : 'translateY(0)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
      fontSize: '24px',
      background: `linear-gradient(135deg, #e0e0e0 40%, ${accentColor2} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      maxWidth: '800px',
      lineHeight: '1.4',
      marginBottom: '30px',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textShadow: '0 2px 8px rgba(0,0,0,0.5)',
      maxHeight: showDescription ? '120px' : '0px',
      opacity: showDescription ? 1 : 0,
      transition: 'max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
      animation: 'fadeInUp 0.7s ease-out forwards'
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
      marginTop: '40px',
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

      <div key={item.id} style={styles.fadeContainer}>
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
        {summary && <p style={styles.summary}>{summary}</p>}
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
