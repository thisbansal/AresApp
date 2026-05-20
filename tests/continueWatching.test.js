import { describe, it, expect } from 'vitest'
import { resolveMediaNavigation } from '../src/utils/mediaNavigation'

describe('Media Navigation Path Resolver', () => {
  it('should route to home "/" if item is null', () => {
    const result = resolveMediaNavigation(null)
    expect(result).toEqual({ path: '/', type: 'home' })
  })

  it('should route standard movie to its details page', () => {
    const movie = { id: 'movie-123', type: 'movie' }
    const result = resolveMediaNavigation(movie, false)
    expect(result).toEqual({ path: '/details/movie-123', type: 'details' })
  })

  it('should route standard season to its parent show details page', () => {
    const season = { id: 'season-456', type: 'season', parentRatingKey: 'show-789' }
    const result = resolveMediaNavigation(season, false)
    expect(result).toEqual({ path: '/details/show-789', type: 'details' })
  })

  it('should route standard episode to its grandparent show details page', () => {
    const episode = { id: 'ep-001', type: 'episode', grandparentRatingKey: 'show-789' }
    const result = resolveMediaNavigation(episode, false)
    expect(result).toEqual({ path: '/details/show-789', type: 'details' })
  })

  it('should route standard episode directly to details of itself if grandparent key is missing', () => {
    const episode = { id: 'ep-002', type: 'episode' }
    const result = resolveMediaNavigation(episode, false)
    expect(result).toEqual({ path: '/details/ep-002', type: 'details' })
  })

  it('should route Continue Watching movie directly to player route', () => {
    const movie = { id: 'movie-123', type: 'movie' }
    const result = resolveMediaNavigation(movie, true)
    expect(result).toEqual({ path: '/play/movie-123', type: 'play' })
  })

  it('should route Continue Watching episode directly to player route', () => {
    const episode = { id: 'ep-001', type: 'episode', grandparentRatingKey: 'show-789' }
    const result = resolveMediaNavigation(episode, true)
    expect(result).toEqual({ path: '/play/ep-001', type: 'play' })
  })
})
