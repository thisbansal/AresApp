import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setStreamSelection } from './plexPlaybackService'
import { plexBridge } from './plexBridge'

vi.mock('./plexBridge', () => ({
  plexBridge: {
    request: vi.fn()
  }
}))

describe('plexPlaybackService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setStreamSelection', () => {
    it('should send a PUT request with the correct audio and subtitle stream IDs', async () => {
      plexBridge.request.mockResolvedValueOnce({ ok: true })

      const result = await setStreamSelection('http://mock', 'token123', 'part-456', 201, 305)

      expect(result).toBe(true)
      expect(plexBridge.request).toHaveBeenCalledWith(
        '/library/parts/part-456?audioStreamID=201&subtitleStreamID=305&allParts=1',
        { method: 'PUT' },
        { uri: 'http://mock', token: 'token123' }
      )
    })

    it('should only include provided stream IDs', async () => {
      plexBridge.request.mockResolvedValueOnce({ ok: true })

      const result = await setStreamSelection('http://mock', 'token123', 'part-456', undefined, 0)

      expect(result).toBe(true)
      expect(plexBridge.request).toHaveBeenCalledWith(
        '/library/parts/part-456?subtitleStreamID=0&allParts=1',
        { method: 'PUT' },
        { uri: 'http://mock', token: 'token123' }
      )
    })

    it('should return true immediately if no stream IDs are provided', async () => {
      const result = await setStreamSelection('http://mock', 'token123', 'part-456')

      expect(result).toBe(true)
      expect(plexBridge.request).not.toHaveBeenCalled()
    })
  })
})
