import { create } from 'zustand'
import { getEnvironment, isWebOS } from '../services/Environment/environment'

export const useEnvironmentStore = create((set, get) => ({
  environment: null,
  isWebOS: false,

  detectEnvironment: () => {
    if (get().environment) return

    const env = getEnvironment()

    set({
      environment: env,
      isWebOS: env === 'webos' && isWebOS(),
    })

    console.log('[env-store]', env)
  },
}))