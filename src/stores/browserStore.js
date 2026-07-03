import { create } from 'zustand'

export const useBrowserStore = create((set) => ({
  activeTab: { type: 'home' },
  setActiveTab: (tab) => set({ activeTab: tab }),

  isHeroSnapped: false,
  setIsHeroSnapped: (val) => set({ isHeroSnapped: val }),

  heroIndex: 0,
  setHeroIndex: (val) => set(state => ({ heroIndex: typeof val === 'function' ? val(state.heroIndex) : val })),

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

  autoSkipIntro: false,
  setAutoSkipIntro: (val) => set({ autoSkipIntro: val }),

  enableAudioPassthrough: false,
  setEnableAudioPassthrough: (val) => set({ enableAudioPassthrough: val }),
}))
