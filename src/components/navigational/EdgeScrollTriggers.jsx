import { useRef } from 'react';
import { useFocusStore } from '../../stores/FocusStore';

export function EdgeScrollTriggers() {
  const { focusedId, itemsRef, focusItem } = useFocusStore();
  const canScrollLeft = useRef(true);
  const canScrollRight = useRef(true);

  const scrollOneItem = (direction) => {
    if (direction === 'left' && !canScrollLeft.current) return;
    if (direction === 'right' && !canScrollRight.current) return;

    if (!focusedId) return;

    const currentItem = itemsRef.get(focusedId);
    if (!currentItem) return;

    const { rowIndex, colIndex } = currentItem;
    const items = Array.from(itemsRef.entries());

    let targetId = null;

    if (direction === 'left') {
      canScrollLeft.current = false;
      targetId = items
        .filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex < colIndex)
        .sort((a, b) => b[1].colIndex - a[1].colIndex)[0]?.[0];
    } else {
      canScrollRight.current = false;
      targetId = items
        .filter(([_, item]) => item.rowIndex === rowIndex && item.colIndex > colIndex)
        .sort((a, b) => a[1].colIndex - b[1].colIndex)[0]?.[0];
    }

    if (targetId) {
      focusItem(targetId);
    }
  };

  const handleMouseEnter = (direction) => {
    scrollOneItem(direction);
  };

  const handleMouseLeave = (direction) => {
    if (direction === 'left') {
      canScrollLeft.current = true;
    } else {
      canScrollRight.current = true;
    }
  };

  return (
    <>
      <div
        className="scroll-trigger-left"
        onMouseEnter={() => handleMouseEnter('left')}
        onMouseLeave={() => handleMouseLeave('left')}
      />
      <div
        className="scroll-trigger-right"
        onMouseEnter={() => handleMouseEnter('right')}
        onMouseLeave={() => handleMouseLeave('right')}
      />
    </>
  );
}