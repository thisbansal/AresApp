import React from 'react'
import { useNotificationStore } from '../../services/notifications/notificationStore'

export function SystemToaster() {
  const notifications = useNotificationStore((state) => state.notifications)
  const removeNotification = useNotificationStore((state) => state.removeNotification)

  if (notifications.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '30px',
        right: '30px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none', // Allows clicking through the container
      }}
    >
      {notifications.map((notif) => {
        let bgColor, borderColor, icon
        
        switch (notif.level) {
          case 'dev':
            bgColor = 'rgba(20, 20, 20, 0.9)'
            borderColor = '#eab308' // Yellow/Orange dev accent
            icon = '🛠️'
            break
          case 'error':
            bgColor = 'rgba(40, 10, 10, 0.85)'
            borderColor = '#ef4444' // Red error accent
            icon = '⚠️'
            break
          case 'success':
            bgColor = 'rgba(10, 40, 20, 0.85)'
            borderColor = '#22c55e' // Green success accent
            icon = '✅'
            break
          case 'info':
          default:
            bgColor = 'rgba(30, 30, 40, 0.85)'
            borderColor = '#3b82f6' // Blue info accent
            icon = 'ℹ️'
            break
        }

        return (
          <div
            key={notif.id}
            onClick={() => removeNotification(notif.id)}
            style={{
              pointerEvents: 'auto', // Allow clicking to dismiss individual toasts
              background: bgColor,
              border: `1px solid ${borderColor}`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '12px',
              padding: '16px 20px',
              color: 'white',
              fontFamily: notif.level === 'dev' ? 'monospace' : '"Inter", "Roboto", sans-serif',
              fontSize: '14px',
              maxWidth: '400px',
              minWidth: '250px',
              wordBreak: 'break-word',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: '1' }}>{icon}</span>
            <div style={{ flex: 1, lineHeight: '1.4' }}>
              {notif.message}
            </div>
          </div>
        )
      })}

      <style>
        {`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(50px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
    </div>
  )
}
