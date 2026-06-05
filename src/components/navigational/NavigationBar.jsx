import React, { useState, useEffect } from 'react';
import { FocusableItem } from './FocusableItem';
import { FiHome, FiSettings, FiUser, FiChevronLeft } from 'react-icons/fi';
import { useSpatialNavigation } from '../../contexts/SpatialNavigationContext';
import { useAppStore } from '../../stores/AppStore';

export function NavigationBar({ libraries = [], activeTab, onItemClick }) {
  const { isNavbarExpanded, setIsNavbarExpanded } = useSpatialNavigation();
  const { userProfile } = useAppStore();
  const [timeStr, setTimeStr] = useState('');

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
    <div 
      className={`nav-wrapper ${isNavbarExpanded ? 'expanded' : 'collapsed'}`} 
      onClick={() => setIsNavbarExpanded(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsNavbarExpanded(false);
        }
      }}
    >
      <div className="nav-capsule">
        {isNavbarExpanded && (
          <div className="nav-header">
            <div className="nav-profile">
              <div className="nav-avatar">
                {userProfile?.thumb ? <img src={userProfile.thumb} alt="Avatar" /> : <FiUser size={24} />}
              </div>
              <div className="nav-username">{userProfile?.userName || 'User'}</div>
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
            onFocus={() => setIsNavbarExpanded(true)}
            onClick={() => onItemClick({ type: 'home' })}
            className={`nav-item ${activeTab?.type === 'home' ? 'active' : ''}`}
          >
            {!isNavbarExpanded && activeTab?.type === 'home' && <FiChevronLeft size={33} className="nav-chevron" />}
            <div className="nav-icon-container">
              <FiHome size={isNavbarExpanded ? 32 : 42} />
            </div>
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
                onFocus={() => setIsNavbarExpanded(true)}
                onClick={() => onItemClick({ type: 'library', data: lib })}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                {!isNavbarExpanded && isActive && <FiChevronLeft size={33} className="nav-chevron" />}
                <div className="nav-icon-container lib-icon">
                  {lib.title.charAt(0).toUpperCase()}
                </div>
                {isNavbarExpanded ? (
                  <div className="nav-text-label">{lib.title}</div>
                ) : (
                  isActive && <div className="nav-text-label collapsed-label">{lib.title}</div>
                )}
              </FocusableItem>
            );
          })}

          {/* Settings Icon */}
          <FocusableItem
            id="nav-settings"
            rowIndex={-1}
            colIndex={libraries.length + 1}
            onFocus={() => setIsNavbarExpanded(true)}
            onClick={() => onItemClick({ type: 'settings' })}
            className={`nav-item ${activeTab?.type === 'settings' ? 'active' : ''}`}
          >
            {!isNavbarExpanded && activeTab?.type === 'settings' && <FiChevronLeft size={33} className="nav-chevron" />}
            <div className="nav-icon-container">
              <FiSettings size={isNavbarExpanded ? 32 : 42} />
            </div>
            {isNavbarExpanded ? (
              <div className="nav-text-label">Settings</div>
            ) : (
              activeTab?.type === 'settings' && <div className="nav-text-label collapsed-label">Settings</div>
            )}
          </FocusableItem>
        </div>
      </div>
    </div>
  );
}
