import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateRememberPinInSession } from '../src/services/luna/settingsStorage'
import { getUserToken, saveUserProfile } from '../src/services/luna/tokenStorage'

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
}
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
}
global.localStorage = localStorageMock
global.sessionStorage = sessionStorageMock

vi.mock('../src/services/luna/tokenStorage', () => ({
  getUserToken: vi.fn(),
  saveUserProfile: vi.fn(),
}))

describe('Switch Profile Privacy Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    sessionStorageMock.clear()
  })

  it('should automatically disable rememberPin and clear userPin on Switch Profile action', async () => {
    const mockProfile = { userId: '164029854', userName: 'Sandeep Bansal', userPin: '1234', rememberPin: true, isProtected: true }
    getUserToken.mockResolvedValue(mockProfile)

    // Trigger update
    await updateRememberPinInSession(false)

    // Ensure saveUserProfile is called with rememberPin: false and userPin: null
    expect(saveUserProfile).toHaveBeenCalledWith({
      userId: '164029854',
      userName: 'Sandeep Bansal',
      userPin: null,
      rememberPin: false,
      isProtected: true,
    })
  })
})
