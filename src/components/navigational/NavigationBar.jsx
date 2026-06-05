import React from 'react';
import { FocusableItem } from './FocusableItem';
import { FiHome, FiSettings } from 'react-icons/fi';

export function NavigationBar({ libraries = [], activeTab, onItemClick }) {
  return (
    <div className="nav-wrapper">
      <div className="nav-capsule">
        <div className="nav-scroll-container">
          {/* Home Icon */}
          <FocusableItem
            id="nav-home"
            rowIndex={-1}
            colIndex={0}
            onClick={() => onItemClick({ type: 'home' })}
            className={`nav-item ${activeTab?.type === 'home' ? 'active' : ''}`}
          >
            <div className="nav-icon-container">
              <FiHome size={32} />
            </div>
          </FocusableItem>

          {/* Library Items */}
          {libraries.map((lib, index) => {
            const uid = lib.serverClientId ? `${lib.serverClientId}-${lib.id}` : `own-${lib.id}`
            const isActive = activeTab?.type === 'library' && 
                             activeTab?.data?.id === lib.id && 
                             activeTab?.data?.serverClientId === lib.serverClientId
            
            return (
              <FocusableItem
                key={`nav-lib-${uid}`}
                id={`nav-lib-${uid}`}
                rowIndex={-1}
                colIndex={index + 1}
                onClick={() => {
                  console.log('[NAV BAR] library clicked:', lib.title)
                  onItemClick({ type: 'library', data: lib })
                }}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <div className="nav-text-container">
                  {lib.title}
                </div>
              </FocusableItem>
            )
          })}

          {/* Settings Icon */}
          <FocusableItem
            id="nav-settings"
            rowIndex={-1}
            colIndex={libraries.length + 1}
            onClick={() => onItemClick({ type: 'settings' })}
            className={`nav-item ${activeTab?.type === 'settings' ? 'active' : ''}`}
          >
            <div className="nav-icon-container">
              <FiSettings size={32} />
            </div>
          </FocusableItem>
        </div>
      </div>
    </div>
  );
}
