import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearAllStoredInfo } from '../src/services/luna/tokenStorage'
import { deleteData, DB_KINDS } from '../src/services/luna/lunaService'
import { KINDS } from '../src/config/app'

vi.mock('../src/services/luna/lunaService', () => ({
  deleteData: vi.fn().mockResolvedValue({ success: true }),
  getData: vi.fn().mockResolvedValue([]),
  DB_KINDS: {
    CONFIG: 'config',
    USER: 'user',
    PREFERENCES: 'preferences',
    SERVER: 'servers'
  }
}))

describe('Sign Out Stored Data Cleansing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should clear main token, user tokens, server address, and preferences from DB8 storage', async () => {
    await clearAllStoredInfo()

    expect(deleteData).toHaveBeenCalledWith('config', 'plexMainToken')
    expect(deleteData).toHaveBeenCalledWith('config', 'lastActiveProfileId')
    expect(deleteData).toHaveBeenCalledWith('config', 'storedProfilesList')
    expect(deleteData).toHaveBeenCalledWith('servers', KINDS.server)
    expect(deleteData).toHaveBeenCalledWith('servers', 'plexSharedServersAuth')
    expect(deleteData).toHaveBeenCalledWith('preferences', KINDS.preferences)
  })
})
