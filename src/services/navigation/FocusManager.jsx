import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const FocusContext = createContext(null);

export function FocusProvider({ children }) {
  const [focusedId, setFocusedId] = useState(null);
  const itemsRef = useRef(new Map());

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
        const rowElement = item.element.closest('.row');

        if (rowElement) {
            const rowRect = rowElement.getBoundingClientRect();

            // More strict visibility check - only scroll if row is significantly off-screen
            const isRowVisible = rowRect.top >= -100 && rowRect.bottom <= window.innerHeight + 100;

            if (!isRowVisible) {
            const scrollTarget = document.scrollingElement || document.documentElement;
            const targetScrollTop = scrollTarget.scrollTop + rowRect.top - (window.innerHeight / 3);

            if (window.setScrollTarget) {
                window.setScrollTarget(targetScrollTop);
            } else {
                scrollTarget.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
                });
            }
            }
        }

        // Simple horizontal scroll
        item.element.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
        });
    }
    }, []);

  const navigate = useCallback((direction) => {
    if (!focusedId) return;

    const currentItem = itemsRef.current.get(focusedId);
    if (!currentItem) return;

    const { rowIndex, colIndex } = currentItem;
    let targetId = null;

    const items = Array.from(itemsRef.current.entries());

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
          targetId = itemsInTargetRow.reduce((closest, current) => {
            const closestDiff = Math.abs(closest[1].colIndex - colIndex);
            const currentDiff = Math.abs(current[1].colIndex - colIndex);
            return currentDiff < closestDiff ? current : closest;
          })[0];
        }
        break;

      case 'down':
        const rowsBelow = items.filter(([_, item]) => item.rowIndex > rowIndex);
        if (rowsBelow.length > 0) {
          const targetRow = Math.min(...rowsBelow.map(([_, item]) => item.rowIndex));
          const itemsInTargetRow = rowsBelow.filter(([_, item]) => item.rowIndex === targetRow);
          targetId = itemsInTargetRow.reduce((closest, current) => {
            const closestDiff = Math.abs(closest[1].colIndex - colIndex);
            const currentDiff = Math.abs(current[1].colIndex - colIndex);
            return currentDiff < closestDiff ? current : closest;
          })[0];
        }
        break;
    }

    if (targetId) {
      focusItem(targetId);
    }
  }, [focusedId, focusItem]);

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
    focusItem
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