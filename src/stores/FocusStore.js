// stores/focusStore.js
import { create } from 'zustand';

export const useFocusStore = create((set, get) => ({
  focusedId: null,
  navigationMode: 'remote', // 'remote' or 'cursor'
  lastRemoteAction: 0,
  itemsRef: new Map(),

  registerItem: (id, element, rowIndex, colIndex) => {
    const { itemsRef, focusedId } = get();
    itemsRef.set(id, { element, rowIndex, colIndex });

    if (itemsRef.size === 1 && !focusedId) {
      set({ focusedId: id });
    } else if (focusedId === id) {
      // Re-trigger focus side-effects (like scrolling to middle) when returning to a page
      get().focusItem(id);
    }
  },

  unregisterItem: (id) => {
    get().itemsRef.delete(id);
  },

  focusItem: (id) => {
    const item = get().itemsRef.get(id);

    if (item) {
      set({ focusedId: id });

      requestAnimationFrame(() => {
        // Vertical scroll (page)
        const { navigationMode } = get();
        if (navigationMode === 'remote') {
          const itemElement = item.element;
          if (itemElement) {
            const itemRect = itemElement.getBoundingClientRect();
            // A card is visible if its entire vertical span fits within viewport margins (e.g. 100px from top and bottom)
            const isItemVisible = itemRect.top >= 100 && itemRect.bottom <= window.innerHeight - 100;

            if (!isItemVisible) {
              const scrollTarget = document.scrollingElement || document.documentElement;
              // Center the focused item vertically in the viewport
              const targetScrollTop = scrollTarget.scrollTop + itemRect.top - (window.innerHeight / 2) + (itemRect.height / 2);

              if (window.setScrollTarget) {
                window.setScrollTarget(targetScrollTop);
              }
            }
          }
        }

        // Horizontal scroll (within row)
        const rowContainer = item.element.closest('.row-items');
        if (rowContainer) {
          const itemRect = item.element.getBoundingClientRect();
          const containerRect = rowContainer.getBoundingClientRect();

          if (itemRect.left < containerRect.left) {
            const scrollAmount = itemRect.left - containerRect.left - 20;
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          } else if (itemRect.right > containerRect.right) {
            const scrollAmount = itemRect.right - containerRect.right + 20;
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
        }
      });
    }
  },

  navigate: (direction) => {
    const { focusedId, itemsRef, focusItem } = get();
    set({ navigationMode: 'remote', lastRemoteAction: Date.now() });

    // Unlock vertical scroll when using D-pad
    if (window.unlockVerticalScroll) {
      window.unlockVerticalScroll();
    }

    if (!focusedId) return;

    const currentItem = itemsRef.get(focusedId);
    if (!currentItem) return;

    const { rowIndex, colIndex } = currentItem;
    let targetId = null;

    const items = Array.from(itemsRef.entries());

    switch (direction) {
      case 'left':
        targetId = items
          .filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex < colIndex)
          .sort((a, b) => b[1].colIndex - a[1].colIndex)[0]?.[0];
        break;

      case 'right':
        targetId = items
          .filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex > colIndex)
          .sort((a, b) => a[1].colIndex - b[1].colIndex)[0]?.[0];
        break;

      case 'up':
        const rowsAbove = items.filter(([_, item]) => item.rowIndex < rowIndex);

        if (rowsAbove.length > 0) {
          const targetRow = Math.max(...rowsAbove.map(([_, item]) => item.rowIndex));
          const itemsInTargetRow = rowsAbove.filter(([_, item]) => item.rowIndex === targetRow);

          const visibleItems = itemsInTargetRow.filter(([_, item]) => {
            const rect = item.element.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= window.innerWidth;
          });

          if (visibleItems.length > 0) {
            targetId = visibleItems.reduce((closest, current) => {
              const closestDiff = Math.abs(closest[1].colIndex - colIndex);
              const currentDiff = Math.abs(current[1].colIndex - colIndex);
              return currentDiff < closestDiff ? current : closest;
            })[0];
          } else {
            targetId = itemsInTargetRow[0]?.[0];
          }
        }
        break;

      case 'down':
        const rowsBelow = items.filter(([_, item]) => item.rowIndex > rowIndex);

        if (rowsBelow.length > 0) {
          const targetRow = Math.min(...rowsBelow.map(([_, item]) => item.rowIndex));
          const itemsInTargetRow = rowsBelow.filter(([_, item]) => item.rowIndex === targetRow);

          const visibleItems = itemsInTargetRow.filter(([_, item]) => {
            const rect = item.element.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= window.innerWidth;
          });

          if (visibleItems.length > 0) {
            targetId = visibleItems.reduce((closest, current) => {
              const closestDiff = Math.abs(closest[1].colIndex - colIndex);
              const currentDiff = Math.abs(current[1].colIndex - colIndex);
              return currentDiff < closestDiff ? current : closest;
            })[0];
          } else {
            targetId = itemsInTargetRow[0]?.[0];
          }
        }
        break;
    }

    if (targetId) {
      focusItem(targetId);
    }
  }
}));