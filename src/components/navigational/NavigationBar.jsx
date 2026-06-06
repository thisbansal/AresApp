import React, { useState, useEffect } from 'react';
import { FocusableItem } from './FocusableItem';
import { FiHome, FiSettings, FiUser } from 'react-icons/fi';
import { MdKeyboardArrowLeft } from 'react-icons/md';
import { useSpatialNavigation, FocusLayer } from '../../contexts/SpatialNavigationContext';
import { useAppStore } from '../../stores/AppStore';

export function NavigationBar({ libraries = [], activeTab, onItemClick }) {
  const { isNavbarExpanded, setIsNavbarExpanded } = useSpatialNavigation();
  const { userProfile } = useAppStore();
  const [timeStr, setTimeStr] = useState('');

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const username = userProfile?.userName || 'User';
  const initials = getInitials(username);

  useEffect(() => {
    if (!isNavbarExpanded) return;
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [isNavbarExpanded]);

  return (
    <FocusLayer id="navbar" isActive={isNavbarExpanded}>
      <div 
        className={`nav-wrapper ${isNavbarExpanded ? 'expanded' : 'collapsed'}`} 
        onBlur={(e) => {
          const currentTarget = e.currentTarget;
          setTimeout(() => {
            if (!currentTarget.contains(document.activeElement)) {
              setIsNavbarExpanded(false);
            }
          }, 0);
        }}
      >
        <div 
          className="nav-capsule"
          onClick={(e) => {
            // Only expand if clicking the capsule or its dead space, not an item.
            if (!isNavbarExpanded) {
               setIsNavbarExpanded(true);
            }
          }}
        >
        {isNavbarExpanded && (
          <div className="nav-header">
            <div className="nav-profile">
              <div className="nav-avatar">
                {userProfile?.thumb ? <img src={userProfile.thumb} alt="Avatar" /> : <div className="nav-avatar-initials">{initials}</div>}
              </div>
            </div>
            <div className="nav-time">{timeStr}</div>
          </div>
        )}

        <div className="nav-scroll-container">
          {/* Home Icon */}
          <FocusableItem
            id="nav-home"
            rowIndex={-1}
            colIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              if (!isNavbarExpanded) {
                setIsNavbarExpanded(true);
                return;
              }
              setIsNavbarExpanded(false);
              if (activeTab?.type !== 'home') {
                onItemClick({ type: 'home' });
              }
            }}
            className={`nav-item ${activeTab?.type === 'home' ? 'active' : ''}`}
          >
            {!isNavbarExpanded && activeTab?.type === 'home' && <MdKeyboardArrowLeft size={38} className="nav-chevron" />}
            
            {!isNavbarExpanded && (
              <div className="nav-icon-container">
                <FiHome size={42} />
              </div>
            )}

            {isNavbarExpanded ? (
              <div className="nav-text-label">Home</div>
            ) : (
              activeTab?.type === 'home' && <div className="nav-text-label collapsed-label">Home</div>
            )}
          </FocusableItem>

          {/* Library Items */}
          {libraries.map((lib, index) => {
            const uid = lib.serverClientId ? `${lib.serverClientId}-${lib.id}` : `own-${lib.id}`;
            const isActive = activeTab?.type === 'library' && 
                             activeTab?.data?.id === lib.id && 
                             activeTab?.data?.serverClientId === lib.serverClientId;
            
            return (
              <FocusableItem
                key={`nav-lib-${uid}`}
                id={`nav-lib-${uid}`}
                rowIndex={-1}
                colIndex={index + 1}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isNavbarExpanded) {
                    setIsNavbarExpanded(true);
                    return;
                  }
                  setIsNavbarExpanded(false);
                  if (!isActive) {
                    onItemClick({ type: 'library', data: lib });
                  }
                }}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                {!isNavbarExpanded && isActive && <MdKeyboardArrowLeft size={38} className="nav-chevron" />}
                
                {/* Only show library icon in collapsed mode */}
                {!isNavbarExpanded && (
                  <div className="nav-icon-container lib-icon">
                    {lib?.title ? lib.title.charAt(0).toUpperCase() : '?'}
                  </div>
                )}

                {isNavbarExpanded ? (
                  <div className="nav-text-label">{lib?.title || 'Library'}</div>
                ) : (
                  isActive && <div className="nav-text-label collapsed-label">{lib?.title || 'Library'}</div>
                )}
              </FocusableItem>
            );
          })}

          {/* Settings Icon */}
          <FocusableItem
            id="nav-settings"
            rowIndex={-1}
            colIndex={libraries.length + 1}
            onClick={(e) => {
              e.stopPropagation();
              if (!isNavbarExpanded) {
                setIsNavbarExpanded(true);
                return;
              }
              setIsNavbarExpanded(false);
              if (activeTab?.type !== 'settings') {
                onItemClick({ type: 'settings' });
              }
            }}
            className={`nav-item ${activeTab?.type === 'settings' ? 'active' : ''}`}
          >
            {!isNavbarExpanded && activeTab?.type === 'settings' && <MdKeyboardArrowLeft size={38} className="nav-chevron" />}
            
            {!isNavbarExpanded && (
              <div className="nav-icon-container">
                <FiSettings size={42} />
              </div>
            )}

            {isNavbarExpanded ? (
              <div className="nav-text-label">Settings</div>
            ) : (
              activeTab?.type === 'settings' && <div className="nav-text-label collapsed-label">Settings</div>
            )}
          </FocusableItem>
        </div>
      </div>
      </div>
    </FocusLayer>
  );
}
