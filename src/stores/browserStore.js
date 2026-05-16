import { create } from 'zustand'

export const useBrowserStore = create((set) => ({
  activeTab: { type: 'home' },
  setActiveTab: (tab) => set({ activeTab: tab }),

  continueWatching: [],
  setContinueWatching: (data) => set({ continueWatching: data }),

  recentMovies: [],
  setRecentMovies: (data) => set({ recentMovies: data }),

  recentTv: [],
  setRecentTv: (data) => set({ recentTv: data }),

  libraryContent: { all: [] },
  setLibraryContent: (data) => set({ libraryContent: data }),

  showNotifications: true,
  setShowNotifications: (val) => set({ showNotifications: val }),

  showUnwatchedIndicator: true,
  setShowUnwatchedIndicator: (val) => set({ showUnwatchedIndicator: val }),
}))
