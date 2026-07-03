import React from 'react';

export function SkeletonRow({ variant = 'poster' }) {
  let width = 240;
  let height = 360; // poster
  
  if (variant === 'landscape') {
    width = 320;
    height = 180;
  } else if (variant === 'square') {
    width = 240;
    height = 240;
  }

  const styles = {
    row: {
      display: 'flex',
      gap: '20px',
      overflow: 'hidden',
      paddingLeft: '45px'
    },
    skeletonItem: {
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: '#2a2d31', // Base grey
      borderRadius: '12px',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden'
    }
  };

  return (
    <div style={styles.row}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={styles.skeletonItem} className="skeleton-shimmer" />
      ))}
    </div>
  );
}
