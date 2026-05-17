// KeyboardHandler.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusStore } from '../../stores/FocusStore';

export function KeyboardHandler() {
  const { navigate, focusedId, itemsRef } = useFocusStore();
  const navigateReactRouter = useNavigate();

  useEffect(() => {
    console.log('KeyboardHandler mounted');

    const handleKeyDown = (e) => {
      // Remote Back Key, Escape, Backspace, webOS keycode 461, Samsung keycode 10009
      if (
        e.key === 'Escape' ||
        e.key === 'Backspace' ||
        e.key === 'BrowserBack' ||
        e.keyCode === 461 ||
        e.keyCode === 10009 ||
        e.keyCode === 27 ||
        e.keyCode === 8
      ) {
        const path = window.location.pathname || '';
        const hash = window.location.hash || '';

        // If we are on home browse or player page, let their own high-priority capture listeners handle it
        if (
          path.includes('/browse') ||
          path.includes('/play') ||
          hash.includes('/browse') ||
          hash.includes('/play')
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        navigateReactRouter(-1); // Navigate back in React Router!
        return;
      }

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
  }, [navigate, navigateReactRouter, focusedId, itemsRef]);

  return null;
}