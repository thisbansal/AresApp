import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generatePin, checkPinAuth } from '../src/services/plex/plexAuthService'
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
})
