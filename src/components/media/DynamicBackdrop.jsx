import React, { useEffect, useState } from 'react';
import { useServerManagerStore } from '../../stores/serverManagerStore';
import { buildImageUrl } from '../../services/plex/plexContentService';

export function DynamicBackdrop({ focusedItem }) {
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [previousImageUrl, setPreviousImageUrl] = useState('');

  useEffect(() => {
    if (!focusedItem) return;

    // Prefer high-res art over thumb
    const artwork = focusedItem.art || focusedItem.thumb;
    if (!artwork) return;

    let nextUrl = artwork;
    if (focusedItem._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[focusedItem._serverContext.clientId];
      if (s && s.uri && s.accessToken) {
        // Request 1920x1080 for backdrop
        nextUrl = buildImageUrl(s.uri, artwork, s.accessToken, 1920, 1080);
      }
    }

    if (nextUrl !== currentImageUrl) {
      setPreviousImageUrl(currentImageUrl);
      setCurrentImageUrl(nextUrl);
    }
  }, [focusedItem, currentImageUrl]);

  const styles = {
    container: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: -1,
      backgroundColor: '#0d0f11',
      pointerEvents: 'none',
    },
    image: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transition: 'opacity 0.8s ease',
    },
    vignette: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      // Premium dark cinematic vignette gradient
      background: 'linear-gradient(to right, rgba(13,15,17,1) 0%, rgba(13,15,17,0.7) 40%, rgba(13,15,17,0) 100%), linear-gradient(to top, rgba(13,15,17,1) 0%, rgba(13,15,17,0) 60%)',
    }
  };

  return (
    <div style={styles.container}>
      {previousImageUrl && (
        <img 
          key={`prev-${previousImageUrl}`}
          src={previousImageUrl} 
          style={{ ...styles.image, opacity: 0 }} 
          alt="" 
        />
      )}
      {currentImageUrl && (
        <img 
          key={`curr-${currentImageUrl}`}
          src={currentImageUrl} 
          style={{ ...styles.image, opacity: 0.6 }} 
          alt="" 
        />
      )}
      <div style={styles.vignette} />
    </div>
  );
}
