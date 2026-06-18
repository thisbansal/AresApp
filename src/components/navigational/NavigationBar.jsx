import React, { useState, useEffect } from 'react';
import { FocusableItem } from './FocusableItem';
import { FiHome, FiSettings, FiUser, FiArrowLeft } from 'react-icons/fi';
import { useSpatialNavigation, FocusLayer } from '../../contexts/SpatialNavigationContext';
import { useAppStore } from '../../stores/AppStore';
import { useServerStore } from '../../stores/serverStore';

export function NavigationBar({ libraries = [], activeTab, onItemClick }) {
  const { isNavbarExpanded, setIsNavbarExpanded } = useSpatialNavigation();
  const { userProfile } = useAppStore();
  const [timeStr, setTimeStr] = useState('');
  const isOnline = useServerStore(state => state.isOnline);
  const [showDynamicIslandAlert, setShowDynamicIslandAlert] = useState(false);
  const [wasOnline, setWasOnline] = useState(isOnline);

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

  useEffect(() => {
    if (wasOnline && !isOnline) {
      setShowDynamicIslandAlert(true);
      const timer = setTimeout(() => {
        setShowDynamicIslandAlert(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
    setWasOnline(isOnline);
  }, [isOnline, wasOnline]);

  useEffect(() => {
    if (isNavbarExpanded) {
      let targetId = 'nav-home';
      if (activeTab?.type === 'settings') {
        targetId = 'nav-settings';
      } else if (activeTab?.type === 'library' && activeTab?.data) {
        const lib = activeTab.data;
        const uid = lib.serverClientId ? `${lib.serverClientId}-${lib.id}` : `own-${lib.id}`;
        targetId = `nav-lib-${uid}`;
      }
      
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.focus({ preventScroll: true });
        }
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isNavbarExpanded, activeTab, libraries]);

  return (
    <FocusLayer id="navbar" isActive={isNavbarExpanded}>
      <div 
        className={`nav-wrapper ${isNavbarExpanded ? 'expanded' : 'collapsed'} ${!isOnline ? 'offline' : ''}`} 
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
        <div className={`nav-dynamic-island ${showDynamicIslandAlert ? 'active' : ''}`}>
          <div className="dynamic-island-pulse-dot" />
          <span className="dynamic-island-text">Offline Mode</span>
        </div>

        {!isOnline && !isNavbarExpanded && (
          <div className="nav-collapsed-offline-icon" />
        )}

        {isNavbarExpanded && (
          <div className="nav-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div className="nav-profile">
                <div className="nav-avatar">
                  {userProfile?.thumb ? <img src={userProfile.thumb} alt="Avatar" /> : <div className="nav-avatar-initials">{initials}</div>}
                </div>
              </div>
              <div className="nav-time">{timeStr}</div>
            </div>
            {!isOnline && (
              <div className="nav-offline-status">
                Offline Mode
              </div>
            )}
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
            <div className="nav-icon-container">
              <FiHome size={42} />
            </div>

            <div className="nav-text-label">Home</div>
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
                <div className="nav-icon-container lib-icon">
                  <FiArrowLeft size={42} />
                </div>

                <div className="nav-text-label">{lib?.title || 'Library'}</div>
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
            <div className="nav-icon-container">
              <FiSettings size={42} />
            </div>

            <div className="nav-text-label">Settings</div>
          </FocusableItem>
        </div>
      </div>
      </div>
    </FocusLayer>
  );
}
