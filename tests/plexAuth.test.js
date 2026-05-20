import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generatePin, checkPinAuth, getUsers, verifyUserPin } from '../src/services/plex/plexAuthService'
import { PLEX_CONFIG } from '../src/config/app'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Plex Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generatePin', () => {
    it('should successfully request a PIN and return correct parameters including the original QR URL', async () => {
      const mockResponseData = {
        id: 123456,
        code: 'ABCD',
        qr: 'https://plex.tv/api/v2/pins/qr/ABCD'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponseData
      })

      const pin = await generatePin()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        `${PLEX_CONFIG.apiUrl}/pins`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'X-Plex-Client-Identifier': PLEX_CONFIG.clientId
          })
        })
      )

      expect(pin).toEqual({
        id: mockResponseData.id,
        code: mockResponseData.code,
        qr: mockResponseData.qr
      })

      // CRITICAL REQUIREMENT CHECK:
      // Make sure the QR code URL is the official Plex-generated one that performs auto-filling
      expect(pin.qr).toBe('https://plex.tv/api/v2/pins/qr/ABCD')
      expect(pin.qr).toContain('/pins/qr/')
    })

    it('should throw an error when the API request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(generatePin()).rejects.toThrow('PIN generation failed: 500')
    })
  })

  describe('checkPinAuth', () => {
    it('should poll the pin status and return authenticated: true with the token', async () => {
      const pinId = 123456
      const mockResponseData = {
        id: pinId,
        code: 'ABCD',
        authToken: 'plex-token-abc-123'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponseData
      })

      const result = await checkPinAuth(pinId)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        `${PLEX_CONFIG.apiUrl}/pins/${pinId}`,
        expect.objectContaining({
          method: 'GET'
        })
      )

      expect(result).toEqual({
        authToken: 'plex-token-abc-123',
        authenticated: true
      })
    })

    it('should return authenticated: false when no token is present', async () => {
      const pinId = 123456
      const mockResponseData = {
        id: pinId,
        code: 'ABCD',
        authToken: null
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponseData
      })

      const result = await checkPinAuth(pinId)

      expect(result).toEqual({
        authToken: null,
        authenticated: false
      })
    })
  })

  describe('getUsers', () => {
    it('should fetch home users and map fields correctly', async () => {
      const mockResponseData = {
        users: [
          { id: '1', title: 'User One', thumb: 'avatar1.png', protected: true, admin: true, pin: '1234' },
          { id: '2', title: 'User Two', thumb: 'avatar2.png', protected: false, admin: false, pin: null }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponseData
      })

      const users = await getUsers('mock-token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://plex.tv/api/v2/home/users',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Plex-Token': 'mock-token'
          })
        })
      )

      expect(users).toEqual([
        { id: '1', name: 'User One', avatar: 'avatar1.png', protected: true, admin: true, pin: '1234' },
        { id: '2', name: 'User Two', avatar: 'avatar2.png', protected: false, admin: false, pin: null }
      ])
    })
  })

  describe('verifyUserPin', () => {
    it('should switch user profile and return the token when pin is correct (JSON response)', async () => {
      const mockResponseData = {
        user: {
          id: '1',
          authToken: 'profile-token-123'
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponseData),
        json: async () => mockResponseData
      })

      const token = await verifyUserPin('mock-token', '1', '1234')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://plex.tv/api/home/users/1/switch',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Plex-Token': 'mock-token'
          }),
          body: JSON.stringify({ pin: '1234' })
        })
      )

      expect(token).toBe('profile-token-123')
    })

    it('should switch user profile and return the token when XML response is returned', async () => {
      const xmlResponse = '<?xml version="1.0" encoding="UTF-8"?><user id="1" authentication-token="xml-profile-token-456" />'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => xmlResponse
      })

      const token = await verifyUserPin('mock-token', '1', '1234')

      expect(token).toBe('xml-profile-token-456')
    })

    it('should handle empty/null PINs for unprotected profiles', async () => {
      const mockResponseData = {
        authToken: 'profile-token-abc'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponseData),
        json: async () => mockResponseData
      })

      const token = await verifyUserPin('mock-token', '2', null)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://plex.tv/api/home/users/2/switch',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ pin: '' })
        })
      )

      expect(token).toBe('profile-token-abc')
    })

    it('should throw an error when switch request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      })

      await expect(verifyUserPin('mock-token', '1', '9999')).rejects.toThrow('PIN verification failed')
    })
  })
})
