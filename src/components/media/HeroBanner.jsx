import React from 'react';
import { FocusableItem } from '../navigational/FocusableItem';
import { FiPlay, FiInfo } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useServerManagerStore } from '../../stores/serverManagerStore';

export function HeroBanner({ focusedItem }) {
  const navigate = useNavigate();

  if (!focusedItem) return null;

  const title = focusedItem.title || 'Unknown Title';
  const year = focusedItem.year;
  const rating = focusedItem.contentRating;
  const duration = focusedItem.duration ? Math.round(focusedItem.duration / 60000) + ' min' : null;
  const summary = focusedItem.summary;

  const handlePlay = () => {
    let targetServerInfo = null;
    if (focusedItem._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[focusedItem._serverContext.clientId];
      if (s) {
        targetServerInfo = { uri: s.uri, token: s.accessToken, owned: s.owned };
      }
    }
    const path = focusedItem.type === 'episode' || focusedItem.type === 'movie' ? `/player/${focusedItem.ratingKey}` : `/details/${focusedItem.ratingKey}`;
    navigate(path, { state: { serverInfo: targetServerInfo, item: focusedItem } });
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      height: '50vh', // Hero takes up top half of screen
      padding: '0 50px 40px 50px',
      color: '#fff',
      zIndex: 1,
      position: 'relative'
    },
    title: {
      fontSize: '64px',
      fontWeight: '800',
      marginBottom: '10px',
      fontFamily: "'Outfit', sans-serif",
      letterSpacing: '-1px',
      textShadow: '0 4px 12px rgba(0,0,0,0.5)',
      maxWidth: '80%'
    },
    metaRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      fontSize: '18px',
      color: '#ccc',
      marginBottom: '20px',
      fontWeight: '500'
    },
    ratingBadge: {
      border: '1px solid #ccc',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 'bold'
    },
    summary: {
      fontSize: '18px',
      color: '#e0e0e0',
      maxWidth: '600px',
      lineHeight: '1.5',
      marginBottom: '30px',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textShadow: '0 2px 8px rgba(0,0,0,0.5)'
    },
    actions: {
      display: 'flex',
      gap: '15px'
    },
    playBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      backgroundColor: '#fff',
      color: '#000',
      padding: '12px 32px',
      borderRadius: '30px',
      fontSize: '20px',
      fontWeight: 'bold',
      border: 'none',
      cursor: 'pointer',
      transform: 'translateZ(0)',
      transition: 'transform 0.2s, background-color 0.2s',
      willChange: 'transform'
    },
    infoBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: '#fff',
      padding: '12px 32px',
      borderRadius: '30px',
      fontSize: '20px',
      fontWeight: 'bold',
      border: '1px solid rgba(255,255,255,0.4)',
      cursor: 'pointer',
      transform: 'translateZ(0)',
      transition: 'transform 0.2s, background-color 0.2s',
      willChange: 'transform'
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{title}</h1>
      <div style={styles.metaRow}>
        {year && <span>{year}</span>}
        {rating && <span style={styles.ratingBadge}>{rating}</span>}
        {duration && <span>{duration}</span>}
      </div>
      {summary && <p style={styles.summary}>{summary}</p>}
      
      <div style={styles.actions}>
        <FocusableItem 
          id="hero-play-btn" 
          onClick={handlePlay}
        >
          <div className="capsule-btn" style={{ border: 'none' }}>
            <FiPlay style={{ marginRight: '10px' }} /> Play
          </div>
        </FocusableItem>

        <FocusableItem 
          id="hero-info-btn" 
          onClick={handlePlay} // Both navigate to details/player for now
        >
          <div className="capsule-btn" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}>
            <FiInfo style={{ marginRight: '10px' }} /> More Info
          </div>
        </FocusableItem>
      </div>
    </div>
  );
}
