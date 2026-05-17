import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { markAsWatched, markAsUnwatched } from '../src/services/plex/plexContentService'

// Helper functions that represent the state updates executed inside components
const toggleWatchedInEpisodes = (episodes, episodeId, nextWatchedState) => {
  return episodes.map(ep => ep.id === episodeId ? { ...ep, viewCount: nextWatchedState ? 1 : 0 } : ep)
}

const toggleWatchedInCards = (items, itemId, nextWatchedState) => {
  return items.map(i => {
    if (i.id === itemId) {
      return {
        ...i,
        viewCount: nextWatchedState ? 1 : 0,
        viewedLeafCount: nextWatchedState ? (i.leafCount || 1) : 0,
        viewOffset: 0
      }
    }
    return i
  })
}

describe('Plex Scrobble & Unscrobble API Service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call fetch with correct URL and parameters to mark an item as watched (scrobble)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    vi.stubGlobal('fetch', fetchMock)

    const serverUri = 'http://localhost:32400'
    const token = 'fake-token'
    const ratingKey = '12345'

    const result = await markAsWatched(serverUri, token, ratingKey)

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:32400/:/scrobble?key=12345&identifier=com.plexapp.plugins.library&X-Plex-Token=fake-token',
      { method: 'GET' }
    )
  })

  it('should call fetch with correct URL and parameters to mark an item as unwatched (unscrobble)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    vi.stubGlobal('fetch', fetchMock)

    const serverUri = 'http://localhost:32400'
    const token = 'fake-token'
    const ratingKey = '12345'

    const result = await markAsUnwatched(serverUri, token, ratingKey)

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:32400/:/unscrobble?key=12345&identifier=com.plexapp.plugins.library&X-Plex-Token=fake-token',
      { method: 'GET' }
    )
  })

  it('should throw an error if the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })
    vi.stubGlobal('fetch', fetchMock)

    const serverUri = 'http://localhost:32400'
    const token = 'fake-token'
    const ratingKey = '12345'

    await expect(markAsWatched(serverUri, token, ratingKey)).rejects.toThrow('Failed to mark as watched: 500')
  })
})

describe('State Updates and Synchronization Logic', () => {
  it('should update episode state when marking an unwatched episode as watched', () => {
    const episodes = [
      { id: 'ep1', title: 'Episode 1', viewCount: 0 },
      { id: 'ep2', title: 'Episode 2', viewCount: 0 }
    ]

    const updated = toggleWatchedInEpisodes(episodes, 'ep1', true)

    expect(updated[0].viewCount).toBe(1)
    expect(updated[1].viewCount).toBe(0)
  })

  it('should update episode state when marking a watched episode as unwatched', () => {
    const episodes = [
      { id: 'ep1', title: 'Episode 1', viewCount: 1 },
      { id: 'ep2', title: 'Episode 2', viewCount: 0 }
    ]

    const updated = toggleWatchedInEpisodes(episodes, 'ep1', false)

    expect(updated[0].viewCount).toBe(0)
    expect(updated[1].viewCount).toBe(0)
  })

  it('should update general poster cards correctly when marked as watched', () => {
    const items = [
      { id: 'movie1', title: 'Movie 1', viewCount: 0, viewOffset: 300 },
      { id: 'show1', title: 'Show 1', viewCount: 0, leafCount: 10, viewedLeafCount: 2 }
    ]

    // Watch Movie 1
    let updated = toggleWatchedInCards(items, 'movie1', true)
    expect(updated[0].viewCount).toBe(1)
    expect(updated[0].viewOffset).toBe(0)

    // Watch Show 1
    updated = toggleWatchedInCards(items, 'show1', true)
    expect(updated[1].viewCount).toBe(1)
    expect(updated[1].viewedLeafCount).toBe(10)
    expect(updated[1].viewOffset).toBe(0)
  })

  it('should update general poster cards correctly when marked as unwatched', () => {
    const items = [
      { id: 'movie1', title: 'Movie 1', viewCount: 1, viewOffset: 0 },
      { id: 'show1', title: 'Show 1', viewCount: 1, leafCount: 10, viewedLeafCount: 10 }
    ]

    // Unwatch Movie 1
    let updated = toggleWatchedInCards(items, 'movie1', false)
    expect(updated[0].viewCount).toBe(0)
    expect(updated[0].viewOffset).toBe(0)

    // Unwatch Show 1
    updated = toggleWatchedInCards(items, 'show1', false)
    expect(updated[1].viewCount).toBe(0)
    expect(updated[1].viewedLeafCount).toBe(0)
    expect(updated[1].viewOffset).toBe(0)
  })
})
