import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateRememberPinInSession } from '../src/services/luna/settingsStorage'
import { hasCompleteSession } from '../src/utils/appSettings'
import { getUserToken, saveUserProfile } from '../src/services/luna/tokenStorage'

vi.mock('../src/services/luna/tokenStorage', () => ({
  getUserToken: vi.fn(),
  saveUserProfile: vi.fn(),
}))

describe('Remember PIN & Session Completion Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  describe('updateRememberPinInSession', () => {
    it('should update rememberPin to true and keep userPin', async () => {
      const mockProfile = { userId: '123', userName: 'Test', userPin: '1111', rememberPin: false }
      getUserToken.mockResolvedValue(mockProfile)

      await updateRememberPinInSession(true)

      expect(saveUserProfile).toHaveBeenCalledWith({
        userId: '123',
        userName: 'Test',
        userPin: '1111',
        rememberPin: true,
      })
    })

    it('should update rememberPin to false and clear userPin', async () => {
      const mockProfile = { userId: '123', userName: 'Test', userPin: '1111', rememberPin: true }
      getUserToken.mockResolvedValue(mockProfile)

      await updateRememberPinInSession(false)

      expect(saveUserProfile).toHaveBeenCalledWith({
        userId: '123',
        userName: 'Test',
        userPin: null,
        rememberPin: false,
      })
    })
  })

  describe('hasCompleteSession', () => {
    it('should return false if no profile token exists', async () => {
      getUserToken.mockResolvedValue(null)
      const result = await hasCompleteSession()
      expect(result).toBe(false)
    })

    it('should return true if sessionStorage activeSession is true', async () => {
      getUserToken.mockResolvedValue({ userId: '123' })
      sessionStorage.setItem('activeSession', 'true')

      const result = await hasCompleteSession()
      expect(result).toBe(true)
    })

    it('should return false if rememberPin is false on startup', async () => {
      getUserToken.mockResolvedValue({ userId: '123', rememberPin: false })
      const result = await hasCompleteSession()
      expect(result).toBe(false)
    })

    it('should return true if unprotected profile and rememberPin is true', async () => {
      getUserToken.mockResolvedValue({ userId: '123', rememberPin: true, isProtected: false })
      const result = await hasCompleteSession()
      expect(result).toBe(true)
    })

    it('should return true if protected profile has stored userPin and rememberPin is true', async () => {
      getUserToken.mockResolvedValue({ userId: '123', rememberPin: true, isProtected: true, userPin: '1111' })
      const result = await hasCompleteSession()
      expect(result).toBe(true)
    })

    it('should return false if protected profile has no userPin and rememberPin is true', async () => {
      getUserToken.mockResolvedValue({ userId: '123', rememberPin: true, isProtected: true, userPin: null })
      const result = await hasCompleteSession()
      expect(result).toBe(false)
    })
  })
})
