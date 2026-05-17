// KeyboardHandler.jsx
import { useEffect } from 'react';
import { useFocusStore } from '../../stores/FocusStore';

export function KeyboardHandler() {
  const { navigate, focusedId, itemsRef } = useFocusStore();

  useEffect(() => {
    console.log('KeyboardHandler mounted');

    const handleKeyDown = (e) => {
      // If we are on the player page, bypass spatial focus navigation
      if (window.location.pathname.startsWith('/play')) {
        return;
      }
      console.log('Key pressed:', e.key);

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          console.log('Navigate left');
          navigate('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          console.log('Navigate right');
          navigate('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          console.log('Navigate up');
          navigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          console.log('Navigate down');
          navigate('down');
          break;
        case 'Enter':
          e.preventDefault();
          const item = itemsRef.get(focusedId);
          if (item) {
            item.element.click();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, focusedId, itemsRef]);

  return null;
}