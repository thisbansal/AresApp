import React from 'react';
import { FocusableItem } from './FocusableItem';

export function NavigationBar({ libraries = [], activeTab, onItemClick }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.capsule}>
        <div style={styles.scrollContainer} className="nav-scroll-container">
          {/* Home Icon */}
          <FocusableItem
            id="nav-home"
            rowIndex={-1}
            colIndex={0}
            onClick={() => onItemClick({ type: 'home' })}
            className={`nav-item ${activeTab?.type === 'home' ? 'active' : ''}`}
          >
            <div style={styles.iconContainer}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
          </FocusableItem>

          {/* Library Items */}
          {libraries.map((lib, index) => (
            <FocusableItem
              key={`nav-lib-${lib.id}`}
              id={`nav-lib-${lib.id}`}
              rowIndex={-1}
              colIndex={index + 1}
              onClick={() => onItemClick({ type: 'library', data: lib })}
              className={`nav-item ${activeTab?.type === 'library' && activeTab?.data?.id === lib.id ? 'active' : ''}`}
            >
              <div style={styles.textContainer}>
                {lib.title}
              </div>
            </FocusableItem>
          ))}

          {/* Settings Icon */}
          <FocusableItem
            id="nav-settings"
            rowIndex={-1}
            colIndex={libraries.length + 1}
            onClick={() => onItemClick({ type: 'settings' })}
            className={`nav-item ${activeTab?.type === 'settings' ? 'active' : ''}`}
          >
            <div style={styles.iconContainer}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
          </FocusableItem>
        </div>
      </div>
      
      <style>{`
        .nav-scroll-container::-webkit-scrollbar {
          display: none;
        }
        .nav-item {
          cursor: pointer;
          color: rgba(255, 255, 255, 0.85); /* bright white text for glass */
          transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
        .nav-item.active {
          background-color: rgba(255, 255, 255, 0.15);
          color: #fff;
          box-shadow: inset 0 0 8px rgba(255, 255, 255, 0.1);
        }
        /* Override FocusableItem's default inline transform for the nav bar to prevent clipping */
        .nav-item[style] {
          transform: scale(1) !important;
        }
        .nav-item.focused {
          background-color: rgba(255, 255, 255, 0.25) !important;
          color: #fff !important;
          transform: scale(1) !important; /* Keep it flush */
        }
        .nav-item:hover {
           background-color: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    // Removed marginBottom to rely entirely on the parent container's gap for consistent spacing
  },
  capsule: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '9999px',     
    maxWidth: '80%',            
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', 
    display: 'flex',
    alignItems: 'stretch',
    padding: '0', // No padding so items are flush against the capsule edge
    overflow: 'hidden', // Clips the rectangular nav items to create the capsule shape on the ends
  },
  scrollContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflowX: 'auto',
    scrollbarWidth: 'none', 
    msOverflowStyle: 'none',
  },
  iconContainer: {
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    padding: '12px 24px',
    fontSize: '28px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  }
};
