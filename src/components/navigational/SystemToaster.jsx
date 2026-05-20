import React from 'react'
import { useNotificationStore } from '../../services/notifications/notificationStore'
import { useBrowserStore } from '../../stores/browserStore'

export function SystemToaster() {
  const notifications = useNotificationStore((state) => state.notifications)
  const removeNotification = useNotificationStore((state) => state.removeNotification)
  const showNotifications = useBrowserStore((state) => state.showNotifications)

  if (!showNotifications || notifications.length === 0) return null

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
        return (
          <div
            key={notif.id}
            onClick={() => removeNotification(notif.id)}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(20, 20, 20, 0.9)',
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
              transition: 'opacity 0.15s ease',
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
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
