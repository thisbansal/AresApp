import { useEffect, useRef } from 'react';
import { useFocusStore } from '../../stores/FocusStore';

export function FocusableItem({ id, rowIndex, colIndex, children, onClick, onFocus, className = '' }) {
  const elementRef = useRef(null);
  const { focusedId, registerItem, unregisterItem, focusItem } = useFocusStore();
  const isFocused = focusedId === id;

  useEffect(() => {
    if (elementRef.current) {
      registerItem(id, elementRef.current, rowIndex, colIndex);
    }
    return () => unregisterItem(id);
  }, [id, rowIndex, colIndex, registerItem, unregisterItem]);

  useEffect(() => {
    if (isFocused && onFocus) {
      onFocus();
    }
  }, [isFocused, onFocus]);

  const handleMouseEnter = () => {
    // Lock vertical scroll when hovering thumbnail
    if (window.lockVerticalScroll) {
      window.lockVerticalScroll();
    }
    focusItem(id);
  };

  const handleClick = () => {
    focusItem(id);
    onClick?.();
  };

  return (
    <div
      ref={elementRef}
      className={`focusable-item ${isFocused ? 'focused' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      style={{
        transform: isFocused ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.3s ease',
        // outline: isFocused ? '4px solid white' : 'none',
        zIndex: isFocused ? 10 : 1,
      }}
    >
      {children}
    </div>
  );
}