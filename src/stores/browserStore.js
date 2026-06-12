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


  showUnwatchedIndicator: true,
  setShowUnwatchedIndicator: (val) => set({ showUnwatchedIndicator: val }),

  subtitleColor: '#AAAAAA',
  setSubtitleColor: (val) => set({ subtitleColor: val }),

  subtitleSize: '2.5rem',
  setSubtitleSize: (val) => set({ subtitleSize: val }),

  showSubtitleHUDControls: false,
  setShowSubtitleHUDControls: (val) => set({ showSubtitleHUDControls: val }),

  enableAudioPassthrough: false,
  setEnableAudioPassthrough: (val) => set({ enableAudioPassthrough: val }),
}))
