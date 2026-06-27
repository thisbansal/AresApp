import React, { useState, useEffect, useRef } from 'react';
import { FocusableItem } from '../navigational/FocusableItem';
import { FiPlay } from 'react-icons/fi';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { MdOutlineKeyboardArrowRight, MdKeyboardArrowDown } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useServerManagerStore } from '../../stores/serverManagerStore';
import { buildImageUrl } from '../../services/plex/plexContentService';
import { useBrowserStore } from '../../stores/browserStore';
import ColorThief from 'colorthief';

export function HeroBanner({ items = [] }) {
  const navigate = useNavigate();
  const currentIndex = useBrowserStore(state => state.heroIndex);
  const setCurrentIndex = useBrowserStore(state => state.setHeroIndex);
  const [userInteracted, setUserInteracted] = useState(0); // Store timestamp of last interaction
  const [accentColor, setAccentColor] = useState('rgb(255, 255, 255)');
  
  const timerRef = useRef(null);
  const imageRefs = useRef([]);

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

  // Dynamically extract accent color from current image using ColorThief
  useEffect(() => {
    const activeImg = imageRefs.current[currentIndex];
    if (!activeImg || !items || items.length === 0) return;

    const extractColor = () => {
      try {
        const colorThief = new ColorThief();
        const color = colorThief.getColor(activeImg);
        if (color) {
          const [r, g, b] = color;
          
          // RGB to HSL conversion to easily adjust readability
          const rgbToHsl = (rVal, gVal, bVal) => {
            rVal /= 255; gVal /= 255; bVal /= 255;
            const max = Math.max(rVal, gVal, bVal), min = Math.min(rVal, gVal, bVal);
            let h, s, l = (max + min) / 2;
            if (max === min) {
              h = s = 0;
            } else {
              const d = max - min;
              s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
              switch (max) {
                case rVal: h = (gVal - bVal) / d + (gVal < bVal ? 6 : 0); break;
                case gVal: h = (bVal - rVal) / d + 2; break;
                case bVal: h = (rVal - gVal) / d + 4; break;
              }
              h /= 6;
            }
            return [h * 360, s * 100, l * 100];
          };

          const [h, s, l] = rgbToHsl(r, g, b);
          // Scale lightness up to at least 70% to ensure readability on dark background
          const finalLightness = Math.max(70, l);
          const finalSaturation = Math.max(40, s);
          
          setAccentColor(`hsl(${Math.round(h)}, ${Math.round(finalSaturation)}%, ${Math.round(finalLightness)}%)`);
        }
      } catch (e) {
        console.error('[ColorThief] Failed to extract color:', e);
        setAccentColor('rgb(255, 255, 255)');
      }
    };

    if (activeImg.complete) {
      extractColor();
    } else {
      activeImg.onload = extractColor;
    }
  }, [currentIndex, items]);

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

  const handleNextSlide = (e) => {
    if (e) e.stopPropagation();
    setUserInteracted(Date.now());
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const handleFocus = () => {
    setUserInteracted(Date.now());
  };

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
      border: '1px solid #ccc',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 'bold'
    },
    summary: {
      fontSize: '24px',
      color: '#e0e0e0',
      maxWidth: '800px',
      lineHeight: '1.4',
      marginBottom: '30px',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textShadow: '0 2px 8px rgba(0,0,0,0.5)',
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
            ref={el => imageRefs.current[idx] = el}
            src={bgUrl} 
            crossOrigin="anonymous"
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
          <h1 style={{ ...styles.title, color: accentColor }}>{title}</h1>
        )}
        <div style={styles.metaRow}>
          {year && <span>{year}</span>}
          {rating && <span style={{ ...styles.ratingBadge, borderColor: accentColor, color: accentColor }}>{rating}</span>}
          {duration && <span>{duration}</span>}
        </div>
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
            onClick={handleInfo}
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
    </div>
  );
}
