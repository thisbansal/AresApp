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
    },
    shimmer: `
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .skeleton-shimmer::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
        animation: shimmer 1.5s infinite linear;
      }
    `
  };

  return (
    <>
      <style>{styles.shimmer}</style>
      <div style={styles.row}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={styles.skeletonItem} className="skeleton-shimmer" />
        ))}
      </div>
    </>
  );
}
