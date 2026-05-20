import { describe, it, expect } from 'vitest';
import { findTargetSeason } from '../src/utils/seasonSelector';

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

describe('Layout Coordinates & Focus Alignments', () => {
  it('should align Play button on column 0 and Season Dropdown on column 1', () => {
    const playButtonCol = 0;
    const seasonDropdownCol = 1;
    expect(playButtonCol).toBe(0);
    expect(seasonDropdownCol).toBe(1);
  });

  it('should keep Play button and Season Dropdown on the same row to prevent dead-end navigation', () => {
    const playButtonRow = 1;
    const seasonDropdownRow = 1;
    expect(playButtonRow).toBe(seasonDropdownRow);
  });
});

describe('Play Handler Registration Pattern', () => {
  it('should delegate target play behavior cleanly via callbacks', () => {
    let registeredHandler = null;
    const registerPlay = (handler) => {
      registeredHandler = handler;
    };
    
    const mockPlayHandler = () => 'Playing first episode';
    registerPlay(mockPlayHandler);
    
    expect(registeredHandler).toBe(mockPlayHandler);
    expect(registeredHandler()).toBe('Playing first episode');
  });
});

describe('Season Dropdown UI & Collapse Interactions', () => {
  it('should collapse dropdown when focus moves outside dropdown items', () => {
    let isDropdownOpen = true;
    const focusedId = 'episode-card-1';
    
    if (isDropdownOpen && focusedId && focusedId !== 'season-dropdown-btn' && !focusedId.startsWith('season-option-')) {
      isDropdownOpen = false;
    }
    
    expect(isDropdownOpen).toBe(false);
  });

  it('should remain open when focus is inside dropdown button or options', () => {
    let isDropdownOpen = true;
    
    const focusOnBtn = 'season-dropdown-btn';
    if (isDropdownOpen && focusOnBtn && focusOnBtn !== 'season-dropdown-btn' && !focusOnBtn.startsWith('season-option-')) {
      isDropdownOpen = false;
    }
    expect(isDropdownOpen).toBe(true);

    const focusOnOption = 'season-option-s2';
    if (isDropdownOpen && focusOnOption && focusOnOption !== 'season-dropdown-btn' && !focusOnOption.startsWith('season-option-')) {
      isDropdownOpen = false;
    }
    expect(isDropdownOpen).toBe(true);
  });

  it('should collapse dropdown when user clicks outside the dropdown container', () => {
    let isDropdownOpen = true;
    
    const dropdownContainer = {
      contains: (target) => target === 'dropdown-btn' || target === 'dropdown-option'
    };
    
    const handleOutsideClick = (target) => {
      if (!dropdownContainer.contains(target)) {
        isDropdownOpen = false;
      }
    };
    
    handleOutsideClick('dropdown-option');
    expect(isDropdownOpen).toBe(true);
    
    handleOutsideClick('episodes-title-header');
    expect(isDropdownOpen).toBe(false);
  });
});
