import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBestServerConnection } from '../plexAPIServer'
import { lunaService } from '../../luna/lunaService'

vi.mock('../../luna/lunaService', () => ({
  lunaService: {
    request: vi.fn()
  }
}))

// Mock global fetch
global.fetch = vi.fn()

describe('plexAPIServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getBestServerConnection should return the fastest reachable connection', async () => {
    const server = {
      connections: [
        { uri: 'http://192.168.1.100:32400', local: true },
        { uri: 'https://192-168-1-100.uuid.plex.direct:32400', local: true }
      ]
    }

    // Mock fetch to simulate reaching the second connection faster
    global.fetch.mockImplementation((url) => {
      return new Promise((resolve, reject) => {
        if (url.includes('plex.direct')) {
          setTimeout(() => resolve({ ok: true }), 50)
        } else {
          setTimeout(() => resolve({ ok: true }), 200)
        }
      })
    })

    const bestUri = await getBestServerConnection(server, 'dummy-token')
    expect(bestUri).toBe('https://192-168-1-100.uuid.plex.direct:32400')
  })

  it('getBestServerConnection should fallback to local IP if DNS rebinding blocks plex.direct', async () => {
    const server = {
      connections: [
        { uri: 'https://192-168-1-100.uuid.plex.direct:32400', local: true, address: '192.168.1.100', port: 32400 }
      ]
    }

    // Mock fetch to simulate plex.direct failing
    global.fetch.mockImplementation((url) => {
      if (url.includes('plex.direct')) {
        return Promise.reject(new Error('Failed to fetch'))
      }
      if (url.includes('192.168.1.100')) {
        return Promise.resolve({ ok: true })
      }
      return Promise.reject(new Error('Not found'))
    })

    const bestUri = await getBestServerConnection(server, 'dummy-token')
    expect(bestUri).toBe('http://192.168.1.100:32400')
  })
})
