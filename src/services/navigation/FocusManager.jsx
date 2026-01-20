import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const FocusContext = createContext(null);

export function FocusProvider({ children }) {
  const [focusedId, setFocusedId] = useState(null);
  const itemsRef = useRef(new Map());
  const edgeScrollTimeout = useRef(null);

  const registerItem = useCallback((id, element, rowIndex, colIndex) => {
    itemsRef.current.set(id, { element, rowIndex, colIndex });

    if (itemsRef.current.size === 1) {
      setFocusedId(id);
    }
  }, []);

  const unregisterItem = useCallback((id) => {
    itemsRef.current.delete(id);
  }, []);

  const focusItem = useCallback((id) => {
    const item = itemsRef.current.get(id);

    if (item) {
      setFocusedId(id);

      requestAnimationFrame(() => {
        // Vertical scroll (page)
        const rowElement = item.element.closest('.row');

        if (rowElement) {
          const rowRect = rowElement.getBoundingClientRect();
          const isRowVisible = rowRect.top >= -100 && rowRect.bottom <= window.innerHeight + 100;

          if (!isRowVisible) {
            const scrollTarget = document.scrollingElement || document.documentElement;
            const targetScrollTop = scrollTarget.scrollTop + rowRect.top - (window.innerHeight / 3);

            if (window.setScrollTarget) {
              window.setScrollTarget(targetScrollTop);
            }
          }
        }

        // Horizontal scroll (within row)
        const rowContainer = item.element.closest('.row-items');
        if (rowContainer) {
          const itemRect = item.element.getBoundingClientRect();
          const containerRect = rowContainer.getBoundingClientRect();

          // Check if item is off-screen horizontally
          if (itemRect.left < containerRect.left) {
            // Scroll left
            const scrollAmount = itemRect.left - containerRect.left - 20;
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          } else if (itemRect.right > containerRect.right) {
            // Scroll right
            const scrollAmount = itemRect.right - containerRect.right + 20;
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
        }
      });
    }
  }, []);

  const scrollOneItem = useCallback((direction) => {
    ('scrollOneItem called:', direction, 'focusedId:', focusedId);

    if (!focusedId) return;

    const currentItem = itemsRef.current.get(focusedId);
    ('currentItem:', currentItem);

    if (!currentItem) return;

    const { rowIndex, colIndex } = currentItem;
    const items = Array.from(itemsRef.current.entries());

    ('Looking for items in row:', rowIndex, 'current col:', colIndex);

    let targetId = null;

    if (direction === 'left') {
      const leftItems = items.filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex < colIndex);
      ('Left items found:', leftItems);
      targetId = leftItems.sort((a, b) => b[1].colIndex - a[1].colIndex)[0]?.[0];
    } else if (direction === 'right') {
      const rightItems = items.filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex > colIndex);
      ('Right items found:', rightItems);
      targetId = rightItems.sort((a, b) => a[1].colIndex - b[1].colIndex)[0]?.[0];
    }

    ('Target ID:', targetId);

    if (targetId) {
      focusItem(targetId);
    }
  }, [focusedId, focusItem]);

const navigate = useCallback((direction) => {
  ('NAVIGATE CALLED:', direction, 'focusedId:', focusedId);

  if (window.unlockVerticalScroll) {
    window.unlockVerticalScroll();
  }

  if (!focusedId) {
    ('No focused item!');
    return;
  }

  const currentItem = itemsRef.current.get(focusedId);
  ('Current item:', currentItem);

  if (!currentItem) {
    ('Current item not found in map!');
    return;
  }

  const { rowIndex, colIndex } = currentItem;
  ('Current position - row:', rowIndex, 'col:', colIndex);

  let targetId = null;

  const items = Array.from(itemsRef.current.entries());
  ('Total items in map:', items.length);

  switch (direction) {
  case 'left':
    const leftItems = items.filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex < colIndex);
    ('Items to the left:', leftItems.length, leftItems);
    targetId = leftItems.sort((a, b) => b[1].colIndex - a[1].colIndex)[0]?.[0];
    break;

  case 'right':
    const rightItems = items.filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex > colIndex);
    ('Items to the right:', rightItems.length, rightItems);
    targetId = rightItems.sort((a, b) => a[1].colIndex - b[1].colIndex)[0]?.[0];
    break;

case 'up':
  const rowsAbove = items.filter(([_, item]) => item.rowIndex < rowIndex);

  if (rowsAbove.length > 0) {
    const targetRow = Math.max(...rowsAbove.map(([_, item]) => item.rowIndex));
    const itemsInTargetRow = rowsAbove.filter(([_, item]) => item.rowIndex === targetRow);

    // Find visible items in the target row
    const visibleItems = itemsInTargetRow.filter(([_, item]) => {
      const rect = item.element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth;
    });

    if (visibleItems.length > 0) {
      // Find the closest visible item to current column
      targetId = visibleItems.reduce((closest, current) => {
        const closestDiff = Math.abs(closest[1].colIndex - colIndex);
        const currentDiff = Math.abs(current[1].colIndex - colIndex);
        return currentDiff < closestDiff ? current : closest;
      })[0];
    } else {
      // Fallback: just take first item
      targetId = itemsInTargetRow[0]?.[0];
    }
  }
  break;

    case 'down':
    const rowsBelow = items.filter(([_, item]) => item.rowIndex > rowIndex);

    if (rowsBelow.length > 0) {
        const targetRow = Math.min(...rowsBelow.map(([_, item]) => item.rowIndex));
        const itemsInTargetRow = rowsBelow.filter(([_, item]) => item.rowIndex === targetRow);

        // Find visible items in the target row
        const visibleItems = itemsInTargetRow.filter(([_, item]) => {
        const rect = item.element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
        });

        if (visibleItems.length > 0) {
        // Find the closest visible item to current column
        targetId = visibleItems.reduce((closest, current) => {
            const closestDiff = Math.abs(closest[1].colIndex - colIndex);
            const currentDiff = Math.abs(current[1].colIndex - colIndex);
            return currentDiff < closestDiff ? current : closest;
        })[0];
        } else {
        // Fallback: just take first item
        targetId = itemsInTargetRow[0]?.[0];
        }
    }
    break;
}

  ('Target found:', targetId);

  if (targetId) {
    focusItem(targetId);
  } else {
    ('No target to navigate to!');
  }
}, [focusedId, focusItem]);

// Edge detection for pointer
// useEffect(() => {
//   const hasScrolledRef = { current: false };
//   const isScrollingRef = { current: false };
//   const wasAtEdge = { current: false };

//   const handlePointerMove = (e) => {
//     if (isScrollingRef.current) return;

//     const EDGE_THRESHOLD = 50;
//     const isLeftEdge = e.clientX < EDGE_THRESHOLD;
//     const isRightEdge = e.clientX > window.innerWidth - EDGE_THRESHOLD;
//     const isAtEdge = isLeftEdge || isRightEdge;

//     // Reset flag when transitioning from edge to non-edge
//     if (wasAtEdge.current && !isAtEdge) {
//       hasScrolledRef.current = false;
//       console.log('Left edge, reset flag');
//     }

//     wasAtEdge.current = isAtEdge;

//     if (isAtEdge && !hasScrolledRef.current) {
//       console.log('At edge, scrolling!');
//       const direction = isLeftEdge ? 'left' : 'right';
//       isScrollingRef.current = true;

//       if (!focusedId) return;

//       const currentItem = itemsRef.current.get(focusedId);
//       if (!currentItem) return;

//       const { rowIndex, colIndex } = currentItem;
//       const items = Array.from(itemsRef.current.entries());

//       let targetId = null;

//       if (direction === 'left') {
//         targetId = items
//           .filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex < colIndex)
//           .sort((a, b) => b[1].colIndex - a[1].colIndex)[0]?.[0];
//       } else if (direction === 'right') {
//         targetId = items
//           .filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex > colIndex)
//           .sort((a, b) => a[1].colIndex - b[1].colIndex)[0]?.[0];
//       }

//       if (targetId) {
//         focusItem(targetId);
//       }

//       hasScrolledRef.current = true;

//       setTimeout(() => {
//         isScrollingRef.current = false;
//       }, 500);
//     }
//   };

//   window.addEventListener('pointermove', handlePointerMove);

//   return () => {
//     window.removeEventListener('pointermove', handlePointerMove);
//   };
// }, []);


  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigate('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigate('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigate('down');
          break;
        case 'Enter':
          e.preventDefault();
          const item = itemsRef.current.get(focusedId);
          if (item) {
            item.element.click();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, focusedId]);

  const value = {
    focusedId,
    registerItem,
    unregisterItem,
    focusItem,
    itemsRef
  };

  return (
    <FocusContext.Provider value={value}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}