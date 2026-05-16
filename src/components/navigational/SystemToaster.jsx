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
        let accentColor, icon
        
        switch (notif.level) {
          case 'dev':
            accentColor = '#eab308' // Yellow/Orange
            icon = '🛠️'
            break
          case 'error':
            accentColor = '#ef4444' // Red
            icon = '⚠️'
            break
          case 'success':
            accentColor = '#22c55e' // Green
            icon = '✅'
            break
          case 'info':
          default:
            accentColor = '#3b82f6' // Blue
            icon = 'ℹ️'
            break
        }

        return (
          <div
            key={notif.id}
            onClick={() => removeNotification(notif.id)}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              borderRadius: '9999px',
              padding: '12px 28px',
              color: 'white',
              fontFamily: notif.level === 'dev' ? 'monospace' : '"Inter", "Roboto", sans-serif',
              fontSize: '18px',
              fontWeight: '500',
              maxWidth: '600px',
              minWidth: '200px',
              wordBreak: 'break-word',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: '1' }}>{icon}</span>
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
