import { describe, it, expect } from 'vitest';
import { resolveMediaNavigation } from './mediaNavigation';

describe('resolveMediaNavigation', () => {
  it('returns home path when item is falsy', () => {
    expect(resolveMediaNavigation(null)).toEqual({ path: '/', type: 'home' });
    expect(resolveMediaNavigation(undefined)).toEqual({ path: '/', type: 'home' });
  });

  it('returns play path with item id when isContinueWatching is true', () => {
    const item = { id: 123, type: 'episode' };
    expect(resolveMediaNavigation(item, true)).toEqual({ path: '/play/123', type: 'play' });
  });

  it('returns details path with grandparentRatingKey when item type is episode and grandparentRatingKey is present', () => {
    const item = { id: 123, type: 'episode', grandparentRatingKey: 456 };
    expect(resolveMediaNavigation(item)).toEqual({ path: '/details/456', type: 'details' });
  });

  it('returns details path with item id when item type is episode but grandparentRatingKey is missing', () => {
    const item = { id: 123, type: 'episode' };
    expect(resolveMediaNavigation(item)).toEqual({ path: '/details/123', type: 'details' });
  });

  it('returns details path with parentRatingKey when item type is season and parentRatingKey is present', () => {
    const item = { id: 123, type: 'season', parentRatingKey: 789 };
    expect(resolveMediaNavigation(item)).toEqual({ path: '/details/789', type: 'details' });
  });

  it('returns details path with item id when item type is season but parentRatingKey is missing', () => {
    const item = { id: 123, type: 'season' };
    expect(resolveMediaNavigation(item)).toEqual({ path: '/details/123', type: 'details' });
  });

  it('returns details path with item id for other basic item types', () => {
    const item = { id: 123, type: 'movie' };
    expect(resolveMediaNavigation(item)).toEqual({ path: '/details/123', type: 'details' });
  });
});
