import { DB_KINDS, getData, setData } from './lunaService'
import { KINDS } from '../../config/app'
import { useBrowserStore } from '../../stores/browserStore'
import { useAppStore } from '../../stores/AppStore'

export const preferenceService = {
  /**
   * Get current active user profile ID
   */
  getProfileId() {
    return useAppStore.getState().userProfile?.userId || 'default'
  },

  /**
   * Load settings from database/localStorage fallback and sync to Zustand browserStore
   */
  async loadPreferences() {
    const profileId = this.getProfileId()
    console.log(`[PreferenceService] Loading preferences for profile ID: ${profileId}`)

    const key = `${KINDS.preferences}_${profileId}`
    let prefs = await getData(DB_KINDS.PREFERENCES, key)

    // Fallback to legacy/global preferences if profile-specific does not exist yet
    if (!prefs) {
      prefs = await getData(DB_KINDS.PREFERENCES, KINDS.preferences)
    }

    if (prefs) {
      const {
        setShowUnwatchedIndicator,
        setSubtitleColor,
        setSubtitleSize,
        setShowSubtitleHUDControls,
        setEnableAudioPassthrough
      } = useBrowserStore.getState()

      if (prefs.showUnwatchedIndicator !== undefined) setShowUnwatchedIndicator(prefs.showUnwatchedIndicator)
      if (prefs.subtitleColor !== undefined) setSubtitleColor(prefs.subtitleColor)
      if (prefs.subtitleSize !== undefined) setSubtitleSize(prefs.subtitleSize)
      if (prefs.showSubtitleHUDControls !== undefined) setShowSubtitleHUDControls(prefs.showSubtitleHUDControls)
      if (prefs.enableAudioPassthrough !== undefined) setEnableAudioPassthrough(prefs.enableAudioPassthrough)

      console.log('[PreferenceService] Preferences successfully loaded & synced:', prefs)
      return prefs
    }

    console.log('[PreferenceService] No preferences found, keeping default store values.')
    return null
  },

  /**
   * Save settings to database/localStorage fallback and update Zustand browserStore
   */
  async savePreferences(updatedFields = {}) {
    const profileId = this.getProfileId()
    const key = `${KINDS.preferences}_${profileId}`

    const storeState = useBrowserStore.getState()
    const currentPrefs = {
      showUnwatchedIndicator: storeState.showUnwatchedIndicator,
      subtitleColor: storeState.subtitleColor,
      subtitleSize: storeState.subtitleSize,
      showSubtitleHUDControls: storeState.showSubtitleHUDControls,
      enableAudioPassthrough: storeState.enableAudioPassthrough,
      ...updatedFields
    }

    console.log(`[PreferenceService] Saving preferences for profile ID ${profileId}:`, currentPrefs)

    // Persist to profile-specific slot
    await setData(DB_KINDS.PREFERENCES, key, currentPrefs)

    // Also persist to global/legacy slot for general fallback
    await setData(DB_KINDS.PREFERENCES, KINDS.preferences, currentPrefs)

    // Update the Zustand store to keep UI reactive
    useBrowserStore.setState(currentPrefs)
  }
}
