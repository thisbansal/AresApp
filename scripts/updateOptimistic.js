const fs = require('fs');

// 1. ContentBrowserPage.jsx
let cbp = fs.readFileSync('src/routes/ContentBrowserPage.jsx', 'utf-8');

cbp = cbp.replace(/const handleToggleWatched = async \(item\) => {[\s\S]*?const newWatchedState = await toggleWatched\(item, targetServerInfo\)/, `const handleToggleWatched = async (item) => {
    let targetServerInfo = serverInfo
    if (item._serverContext?.clientId) {
      const s = useServerManagerStore.getState().servers[item._serverContext.clientId]
      if (s) {
        targetServerInfo = { uri: s.uri, token: s.accessToken, owned: s.owned }
      }
    } else if (activeTab.type === 'library' && activeTab.data?.isShared) {
      targetServerInfo = { uri: activeTab.data.serverUri, token: activeTab.data.token }
    }

    // Determine current state based on item
    let isUnwatched = false;
    if (item.type === 'show' || item.type === 'season') {
      isUnwatched = item.leafCount ? (Number(item.viewedLeafCount || 0) < Number(item.leafCount)) : (Number(item.viewedLeafCount || 0) === 0);
    } else {
      isUnwatched = Number(item.viewCount || 0) === 0;
    }
    const targetWatchedState = isUnwatched;

    const updateItemOptimistic = (i) => {
      if (i.id === item.id) {
        if (targetWatchedState) {
          return {
            ...i,
            viewCount: 1,
            viewedLeafCount: i.leafCount || 1,
            viewOffset: 0
          }
        } else {
          return {
            ...i,
            viewCount: 0,
            viewedLeafCount: 0,
            viewOffset: 0
          }
        }
      }
      return i
    }

    // Optimistic UI Update
    setRecentMovies((useBrowserStore.getState().recentMovies || []).map(updateItemOptimistic))
    setRecentTv((useBrowserStore.getState().recentTv || []).map(updateItemOptimistic))
    setLibraryContent({
      all: (useBrowserStore.getState().libraryContent?.all || []).map(updateItemOptimistic)
    })

    const newWatchedState = await toggleWatched(item, targetServerInfo)`);

cbp = cbp.replace(/setContinueWatching\(\(continueWatching \|\| \[\]\)\n\s*\.map\(updateItem\)\n\s*\.filter\(i => !\(newWatchedState && i\.id === item\.id\)\)\n\s*\)\n\s*setRecentMovies\(\(recentMovies \|\| \[\]\)\.map\(updateItem\)\)\n\s*setRecentTv\(\(recentTv \|\| \[\]\)\.map\(updateItem\)\)\n\s*setLibraryContent\(\{\n\s*all: \(libraryContent\.all \|\| \[\]\)\.map\(updateItem\)\n\s*\}\)/, `setContinueWatching((useBrowserStore.getState().continueWatching || [])
        .map(updateItem)
        .filter(i => !(newWatchedState && i.id === item.id))
      )`);

fs.writeFileSync('src/routes/ContentBrowserPage.jsx', cbp);
console.log('ContentBrowserPage.jsx updated');
