import { describe, it, expect } from 'vitest';
import { findTargetSeason } from '../seasonSelector';

describe('findTargetSeason', () => {
  const createSeason = (id, index, title, viewedLeafCount, leafCount) => ({
    id,
    index,
    title,
    viewedLeafCount,
    leafCount
  });

  it('should select Season 1 when all regular seasons are unwatched, skipping Specials', () => {
    const seasons = [
      createSeason('specials', 0, 'Specials', 0, 5),
      createSeason('s1', 1, 'Season 1', 0, 10),
      createSeason('s2', 2, 'Season 2', 0, 10),
    ];
    const target = findTargetSeason(seasons);
    expect(target.id).toBe('s1');
  });

  it('should auto-skip fully finished seasons and select the first unfinished regular season', () => {
    const seasons = [
      createSeason('specials', 0, 'Specials', 0, 5),
      createSeason('s1', 1, 'Season 1', 10, 10),
      createSeason('s2', 2, 'Season 2', 0, 10),
    ];
    const target = findTargetSeason(seasons);
    expect(target.id).toBe('s2');
  });

  it('should select Specials if all regular seasons are completed and Specials is unfinished', () => {
    const seasons = [
      createSeason('specials', 0, 'Specials', 0, 5),
      createSeason('s1', 1, 'Season 1', 10, 10),
      createSeason('s2', 2, 'Season 2', 10, 10),
    ];
    const target = findTargetSeason(seasons);
    expect(target.id).toBe('specials');
  });

  it('should fallback to Season 1 (not Specials) when all regular and specials are fully finished', () => {
    const seasons = [
      createSeason('specials', 0, 'Specials', 5, 5),
      createSeason('s1', 1, 'Season 1', 10, 10),
      createSeason('s2', 2, 'Season 2', 10, 10),
    ];
    const target = findTargetSeason(seasons);
    expect(target.id).toBe('s1');
  });

  it('should select Specials if it is the only season available in the show', () => {
    const seasons = [
      createSeason('specials', 0, 'Specials', 0, 5),
    ];
    const target = findTargetSeason(seasons);
    expect(target.id).toBe('specials');
  });
});
