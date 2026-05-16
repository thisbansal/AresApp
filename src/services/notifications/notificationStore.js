import { create } from 'zustand'

export const useNotificationStore = create((set, get) => ({
  notifications: [],

  /**
   * Adds a new notification to the system toaster.
   * @param {string} message - The message to display.
   * @param {Object} options - Configuration options.
   * @param {'dev' | 'info' | 'success' | 'error'} options.level - The severity/type of the notification.
   * @param {number} [options.timeout] - Custom timeout before auto-dismiss (ms).
   */
  addNotification: (message, { level = 'info', timeout } = {}) => {
    // Force dev notifications to always show for debugging purposes right now
    // if (level === 'dev' && !import.meta.env.DEV) {
    //   return
    // }

    const currentNotifications = get().notifications

    // Deduplication: Don't show the exact same message if it's already active
    const isDuplicate = currentNotifications.some((n) => n.message === message && n.level === level)
    if (isDuplicate) {
      return
    }

    const id = Date.now() + '-' + Math.random().toString(36).substring(2, 9)
    
    // Default timeouts: longer for dev/errors, shorter for success/info
    const autoDismissTimeout = timeout || (level === 'dev' || level === 'error' ? 7000 : 4000)

    set((state) => ({
      // Keep a maximum of 4 notifications on screen
      notifications: [...state.notifications, { id, message, level, timeout: autoDismissTimeout }].slice(-4)
    }))

    // Auto dismiss
    if (autoDismissTimeout > 0) {
      setTimeout(() => {
        get().removeNotification(id)
      }, autoDismissTimeout)
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }))
  }
}))
