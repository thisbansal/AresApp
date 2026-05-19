import { create } from 'zustand'

export const useServerStore = create((set) => ({
  isOnline: true,
  lastChecked: null,
  connectionError: null,
  activeServer: null,
  logs: [],

  setServerState: (isOnline, error = null) => {
    set({
      isOnline,
      connectionError: error,
      lastChecked: Date.now()
    })
  },

  log: (severity, message, context = null) => {
    const timestamp = new Date().toISOString()
    const logEntry = { timestamp, severity, message, context }
    
    const prefix = `[${severity}] [${timestamp}]`
    if (severity === 'FATAL' || severity === 'ERROR') {
      console.error(prefix, message, context || '')
    } else if (severity === 'WARN') {
      console.warn(prefix, message, context || '')
    } else {
      console.log(prefix, message, context || '')
    }

    set((state) => ({
      logs: [logEntry, ...state.logs].slice(0, 100) // keep last 100 logs
    }))
  }
}))
