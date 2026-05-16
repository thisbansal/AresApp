import {create} from 'zustand'
import { getMainToken } from '../services/luna/tokenStorage'

export const useAppStore = create((set, get) => ({
    isAuthenticated: false,
    serverAddresses: [],
    token: null,

    getToken: async() => {
        const { token } = get()

        if (token) return token

        const fetchedToken = await getMainToken();

        if (fetchToken) {
            set({token: fetchToken, isAuthenticated: true})
        }

        return fetchedToken
    },

    clearToken: () => set({
        token: null,
        isAuthenticated: false
    }),

    getServerAddresses: async() => {

    }
}))