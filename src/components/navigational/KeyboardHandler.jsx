// KeyboardHandler.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusStore } from '../../stores/FocusStore';

export function KeyboardHandler() {
  const { navigate, focusedId, itemsRef, showExitDialog, setShowExitDialog } = useFocusStore();
  const navigateReactRouter = useNavigate();

  useEffect(() => {
    console.log('KeyboardHandler mounted. ExitDialog State:', showExitDialog);

    const handleKeyDown = (e) => {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';

      // Check if we are currently displaying the exit modal dialog
      if (showExitDialog) {
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape', 'Backspace', 'BrowserBack'].includes(e.key) ||
          e.keyCode === 461 ||
          e.keyCode === 10009
        ) {
          e.preventDefault();
          e.stopPropagation();

          const currentFocus = useFocusStore.getState().focusedId;

          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Toggle focus state between Cancel and Yes buttons
            const nextFocus = currentFocus === 'exit-exit' ? 'exit-cancel' : 'exit-exit';
            useFocusStore.setState({ focusedId: nextFocus, lastRemoteAction: Date.now() });
          } else if (e.key === 'Enter' || e.key === ' ') {
            if (currentFocus === 'exit-exit') {
              console.log('[ExitDialog] Confirmed exit. Shutting application down.');
              if (window.close) window.close();
              if (window.webOS && window.webOS.toApp) window.webOS.toApp('close');
            } else {
              setShowExitDialog(false);
            }
          } else if (
            e.key === 'Escape' ||
            e.key === 'Backspace' ||
            e.key === 'BrowserBack' ||
            e.keyCode === 461 ||
            e.keyCode === 10009
          ) {
            setShowExitDialog(false);
          }
          return;
        }
      }

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
        // If typing in inputs, let default browser behavior handle it
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // 1. If on login, server-select, user-select, or homepage/browse, back key triggers the global exit dialog box
        const isLoginRoute = hash.includes('/login') || path.includes('/login');
        const isServerSelectRoute = hash.includes('/server-select') || path.includes('/server-select');
        const isUserSelectRoute = hash.includes('/user-select') || path.includes('/user-select');
        const isHomeRoute = hash.includes('/browse') || path.includes('/browse') || hash.includes('/home') || path.includes('/home');

        if (isLoginRoute || isServerSelectRoute || isUserSelectRoute || isHomeRoute) {
          console.log('[AUTH FLOW] Back button triggered on entry/exit route. Showing global ExitDialog.');
          setShowExitDialog(true);
        } else if (hash.includes('/play') || path.includes('/play')) {
          // Let video player internal back capture handles it
          return;
        } else {
          // 2. If in-between (e.g. user-select), naturally redirect to the previous route (traverse back in react router history)
          console.log('[AUTH FLOW] Back button triggered in setup flow. Traversing back in router history.');
          navigateReactRouter(-1);
        }
        return;
      }

      // If we are on the player page, bypass spatial focus navigation
      if (path.startsWith('/play') || hash.startsWith('#/play')) {
        return;
      }

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
          const item = itemsRef.get(focusedId);
          if (item) {
            item.element.click();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase so we override routing and focus strictly
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [navigate, navigateReactRouter, focusedId, itemsRef, showExitDialog, setShowExitDialog]);

  return null;
}
