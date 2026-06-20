import React, { useState, useEffect, useRef } from 'react';
import { FocusableItem } from '../navigational/FocusableItem';
import { FiPlay } from 'react-icons/fi';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { MdOutlineKeyboardArrowRight } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useServerManagerStore } from '../../stores/serverManagerStore';
import { buildImageUrl } from '../../services/plex/plexContentService';

export function HeroBanner({ items = [] }) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  
  const timerRef = useRef(null);

  // Auto-advance logic
  useEffect(() => {
    if (!items || items.length === 0 || userInteracted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }, 8000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items, userInteracted, items.length]);

  // Global keydown listener to stop timer on remote interaction
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Any navigation keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        setUserInteracted(true);
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

  const handlePlay = () => {
    let targetServerInfo = null;
    if (item._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId];
      if (s) {
        targetServerInfo = { uri: s.uri, token: s.accessToken, owned: s.owned };
      }
    }
    const path = item.type === 'episode' || item.type === 'movie' ? `/player/${item.ratingKey}` : `/details/${item.ratingKey}`;
    navigate(path, { state: { serverInfo: targetServerInfo, item: item } });
  };

  const handleNextSlide = () => {
    setUserInteracted(true);
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const handleFocus = () => {
    setUserInteracted(true);
    // State 3 -> 2: If the user brings focus to the hero banner from below, smoothly scroll up.
    if (window.scrollY > 0) {
      const html = document.documentElement;
      const originalSnap = html.style.scrollSnapType;
      html.style.scrollSnapType = 'none';
      
      const startY = window.scrollY;
      const duration = 500;
      const startTime = performance.now();
      
      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        window.scrollTo(0, startY * (1 - easeProgress));
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          html.style.scrollSnapType = originalSnap;
        }
      };
      
      requestAnimationFrame(animateScroll);
    }
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      height: '100vh', // Full screen height
      padding: '0 50px 25vh 45px', // Aligned with the Continue Watching row padding (45px)
      color: '#fff',
      zIndex: 1,
      position: 'relative',
      overflow: 'hidden',
      scrollSnapAlign: 'start',
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
      animation: 'fadeInUp 0.8s ease-out forwards'
    },
    dotsContainer: {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: '25vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      maxWidth: '40%'
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
    <div style={styles.container}>
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
        <h1 style={styles.title}>{title}</h1>
        <div style={styles.metaRow}>
          {year && <span>{year}</span>}
          {rating && <span style={styles.ratingBadge}>{rating}</span>}
          {duration && <span>{duration}</span>}
        </div>
        {summary && <p style={styles.summary}>{summary}</p>}
      </div>
      
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
            onClick={handlePlay}
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

      <div style={styles.dotsContainer}>
        {items.map((_, idx) => {
          // Calculate shortest circular distance
          const d = Math.abs(idx - currentIndex);
          const distance = Math.min(d, items.length - d);
          return <div key={idx} style={styles.dot(distance, idx === currentIndex)} />;
        })}
      </div>
    </div>
  );
}
