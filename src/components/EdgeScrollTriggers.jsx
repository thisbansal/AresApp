// components/EdgeScrollTriggers.jsx
import { useRef } from 'react';
import { useFocus } from '../services/navigation/focusManager';

export function EdgeScrollTriggers() {
  const { focusedId, itemsRef, focusItem } = useFocus(); // Add focusItem here
  const canScrollLeft = useRef(true);
  const canScrollRight = useRef(true);

  const scrollOneItem = (direction) => {
    if (direction === 'left' && !canScrollLeft.current) return;
    if (direction === 'right' && !canScrollRight.current) return;

    if (!focusedId) return;

    const currentItem = itemsRef.current.get(focusedId);
    if (!currentItem) return;

    const { rowIndex, colIndex } = currentItem;
    const items = Array.from(itemsRef.current.entries());

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
      focusItem(targetId); // Now this will work
    }
  };

  const handleMouseEnter = (direction) => {
    console.log('Mouse entered', direction, 'canScroll:', direction === 'left' ? canScrollLeft.current : canScrollRight.current);
    scrollOneItem(direction);
  };

  const handleMouseLeave = (direction) => {
    console.log('Mouse left', direction);
    setTimeout(() => {
        if (direction === 'left') {
          canScrollLeft.current = true;
        } else {
          canScrollRight.current = true;
        }
     }, 500)
    console.log('Reset canScroll for', direction, 'to true');
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