import React from 'react';
import { FocusableItem } from '../navigational/FocusableItem';

export function EmptyState({ message = "It's quiet in here...", subtext = "Your libraries are currently empty. Add media to your server to get started.", onRefresh }) {
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      color: '#e0e0e0',
      textAlign: 'center'
    },
    svg: {
      width: '120px',
      height: '120px',
      marginBottom: '30px',
      opacity: 0.8,
      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))'
    },
    message: {
      fontSize: '32px',
      fontWeight: '700',
      marginBottom: '15px',
      fontFamily: "'Outfit', sans-serif"
    },
    subtext: {
      fontSize: '20px',
      color: '#a0a0a0',
      maxWidth: '400px',
      lineHeight: '1.5',
      marginBottom: '40px'
    },
    btn: {
      padding: '12px 32px',
      backgroundColor: '#e5a00d',
      color: '#fff',
      border: 'none',
      borderRadius: '30px',
      fontSize: '18px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transform: 'translateZ(0)',
      transition: 'transform 0.2s, background-color 0.2s',
      willChange: 'transform'
    }
  };

  return (
    <div style={styles.container}>
      <svg 
        style={styles.svg} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        {/* Stylized Film Reel / Slate */}
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M7 4v16" />
        <path d="M17 4v16" />
        <path d="M2 8h20" />
        <path d="M2 12h20" />
        <path d="M2 16h20" />
        <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/>
      </svg>

      <h2 style={styles.message}>{message}</h2>
      <p style={styles.subtext}>{subtext}</p>
      
      {onRefresh && (
        <FocusableItem id="empty-state-refresh" onClick={onRefresh}>
          <div className="capsule-btn" style={{ backgroundColor: '#e5a00d', color: '#fff', border: 'none' }}>
            Refresh Connection
          </div>
        </FocusableItem>
      )}
    </div>
  );
}
