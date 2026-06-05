import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRecentlyAdded } from '../src/services/plex/plexContentService'
import { useAppStore } from '../src/stores/AppStore'
import { plexBridge } from '../src/services/plex/plexBridge'

// Mock plexBridge
vi.mock('../src/services/plex/plexBridge', () => ({
  plexBridge: {
    request: vi.fn()
  }
}))

describe('Plex Content Service - Image URL Token Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ mainToken: null }) // Reset store state
  })

  it('should use mainToken from AppStore for image transcode URLs if mainToken is set', async () => {
    // 1. Mock store state to have a mainToken
    useAppStore.setState({ mainToken: 'admin-token-xyz' })

    // 2. Mock plexBridge.request response metadata
    const mockResponse = {
      MediaContainer: {
        Metadata: [
          {
            ratingKey: '123',
            title: 'Test Movie',
            type: 'movie',
            thumb: '/library/metadata/123/thumb',
            art: '/library/metadata/123/art'
          }
        ]
      }
    }
    
    plexBridge.request.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    // 3. Call getRecentlyAdded with a profile-specific token
    const items = await getRecentlyAdded('http://pms:32400', 'profile-token-abc')

    // 4. Verify that the constructed image URLs contain the mainToken (admin-token-xyz) rather than the profile-token-abc
    expect(items).toHaveLength(1)
    const item = items[0]
    
    expect(item.thumb).not.toContain('X-Plex-Token=admin-token-xyz')
    expect(item.thumb).toContain('X-Plex-Token=profile-token-abc')
    expect(item.art).not.toContain('X-Plex-Token=admin-token-xyz')
    expect(item.art).toContain('X-Plex-Token=profile-token-abc')
  })

  it('should fallback to passed token if mainToken is not set in AppStore', async () => {
    // 1. Ensure mainToken is null in store
    useAppStore.setState({ mainToken: null })

    // 2. Mock plexBridge.request response metadata
    const mockResponse = {
      MediaContainer: {
        Metadata: [
          {
            ratingKey: '456',
            title: 'Fallback Movie',
            type: 'movie',
            thumb: '/library/metadata/456/thumb',
            art: '/library/metadata/456/art'
          }
        ]
      }
    }
    
    plexBridge.request.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    // 3. Call getRecentlyAdded with a profile-specific token
    const items = await getRecentlyAdded('http://pms:32400', 'fallback-profile-token')

    // 4. Verify that the constructed image URLs fallback to fallback-profile-token
    expect(items).toHaveLength(1)
    const item = items[0]
    
    expect(item.thumb).toContain('X-Plex-Token=fallback-profile-token')
    expect(item.art).toContain('X-Plex-Token=fallback-profile-token')
  })
})
