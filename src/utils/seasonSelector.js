/**
 * Identifies the target season the user is most likely to want to browse.
 * Follows a multi-phase priority logic:
 * 1. Finds the first regular season (index > 0, not Specials) that has unwatched episodes.
 * 2. Finds the first Specials season (index === 0, or titled "Specials") that has unwatched episodes.
 * 3. Finds the first regular season (index > 0), even if fully finished (to avoid starting on Specials).
 * 4. Fallback to the first season in the list.
 * 
 * @param {Array} seasons - List of season objects.
 * @returns {Object|null} The targeted season object or null if list is empty.
 */
export function findTargetSeason(seasons) {
  if (!seasons || seasons.length === 0) return null;

  // 1. Find the first regular season (index > 0) with unwatched episodes
  const unfinishedRegular = seasons.find(s => {
    const isSpecials = s.index === 0 || s.title?.toLowerCase().includes('specials');
    const viewed = Number(s.viewedLeafCount || 0);
    const total = Number(s.leafCount || 0);
    return !isSpecials && total > 0 && viewed < total;
  });

  if (unfinishedRegular) return unfinishedRegular;

  // 2. Find the first Specials season with unwatched episodes
  const unfinishedSpecials = seasons.find(s => {
    const isSpecials = s.index === 0 || s.title?.toLowerCase().includes('specials');
    const viewed = Number(s.viewedLeafCount || 0);
    const total = Number(s.leafCount || 0);
    return isSpecials && total > 0 && viewed < total;
  });

  if (unfinishedSpecials) return unfinishedSpecials;

  // 3. Fallback to the first regular season (index > 0)
  const firstRegular = seasons.find(s => {
    const isSpecials = s.index === 0 || s.title?.toLowerCase().includes('specials');
    return !isSpecials;
  });

  if (firstRegular) return firstRegular;

  // 4. Ultimate fallback to first season
  return seasons[0];
}
