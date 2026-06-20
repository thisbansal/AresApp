// KeyboardHandler.jsx
import { useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSpatialNavigation } from '../../contexts/SpatialNavigationContext';
import { useAppStore } from '../../stores/AppStore';
import { useBrowserStore } from '../../stores/browserStore';

export function KeyboardHandler() {
  const { 
    navigate: spatialNavigate, 
    showExitDialog, 
    setShowExitDialog, 
    showSignoutConfirm,
    setShowSignoutConfirm,
    isNavbarExpanded, 
    setIsNavbarExpanded,
    activeLayer
  } = useSpatialNavigation();
  const navigateReactRouter = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('KeyboardHandler mounted. Active Layer:', activeLayer);

    const handleKeyDown = (e) => {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';

      // Check if we are currently displaying a dialog layer (exit or sign-out)
      if (activeLayer === 'exit-dialog' || activeLayer === 'signout-dialog') {
        const isExit = activeLayer === 'exit-dialog';
        const cancelId = isExit ? 'exit-cancel' : 'signout-cancel';
        const confirmId = isExit ? 'exit-exit' : 'signout-confirm';

        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape', 'Backspace', 'BrowserBack'].includes(e.key) ||
          e.keyCode === 461 ||
          e.keyCode === 10009
        ) {
          e.preventDefault();
          e.stopPropagation();

          const activeEl = document.activeElement;
          const currentId = activeEl?.id || '';

          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Toggle focus state between Cancel and Yes buttons
            const nextId = currentId === confirmId ? cancelId : confirmId;
            const nextEl = document.getElementById(nextId);
            if (nextEl) nextEl.focus({ preventScroll: true });
          } else if (e.key === 'Enter' || e.key === ' ') {
            if (currentId === confirmId) {
              if (isExit) {
                console.log('[ExitDialog] Confirmed exit. Shutting application down.');
                if (window.close) window.close();
                if (window.webOS && window.webOS.toApp) window.webOS.toApp('close');
              } else {
                // Trigger actual sign-out click handler on the confirm button
                const confirmBtn = document.getElementById('signout-confirm');
                if (confirmBtn) confirmBtn.click();
              }
            } else {
              if (isExit) {
                setShowExitDialog(false);
              } else {
                setShowSignoutConfirm(false);
              }
            }
          } else if (
            e.key === 'Escape' ||
            e.key === 'Backspace' ||
            e.key === 'BrowserBack' ||
            e.keyCode === 461 ||
            e.keyCode === 10009
          ) {
            if (isExit) {
              setShowExitDialog(false);
            } else {
              setShowSignoutConfirm(false);
            }
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

        // Issue 5: PIN pad backspace intercept
        if (window.handlePinBackspace && window.handlePinBackspace()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const isLoginRoute = hash.includes('/login') || path.includes('/login');
        const isServerSelectRoute = hash.includes('/server-select') || path.includes('/server-select');
        const isLibrarySelectRoute = hash.includes('/library-select') || path.includes('/library-select') || location.pathname === '/library-select';
        const isUserSelectRoute = hash.includes('/user-select') || path.includes('/user-select');
        const isHomeRoute = hash.includes('/browse') || path.includes('/browse') || hash.includes('/home') || path.includes('/home');

        const isColdStart = !window.history.state || window.history.state.idx === 0;

        if (isLibrarySelectRoute) {
          const fromSettings = location.state?.from === 'settings';
          const selectedLibraries = useAppStore.getState().selectedLibraries || [];
          if (selectedLibraries.length === 0) {
            console.log('[AUTH FLOW] KeyboardHandler: Back key blocked. Needs at least 1 library.');
            return;
          }
          if (fromSettings) {
            console.log('[AUTH FLOW] KeyboardHandler: Navigating back to browse.');
            navigateReactRouter('/browse', { replace: true });
          } else {
            console.log('[AUTH FLOW] KeyboardHandler: Navigating back to server select.');
            navigateReactRouter('/server-select');
          }
          return;
        }

        // Layer-based back key navigation resolver
        if (activeLayer === 'signout-dialog') {
          console.log('[KeyboardHandler] Back key: Closing sign-out dialog.');
          setShowSignoutConfirm(false);
          return;
        }

        if (activeLayer === 'exit-dialog') {
          console.log('[KeyboardHandler] Back key: Closing exit dialog.');
          setShowExitDialog(false);
          return;
        }

        if (activeLayer === 'navbar') {
          console.log('[KeyboardHandler] Back key: Collapsing navbar.');
          setIsNavbarExpanded(false);
          return;
        }

        if (isHomeRoute) {
          const activeEl = document.activeElement;
          
          if (window.isNavigationLocked) return;

          // State 3 -> State 2: User is scrolled down
          if (window.scrollY > 100) {
            console.log('[KeyboardHandler] Back key: State 3 -> 2. Snapping to Hero Banner.');
            window.isNavigationLocked = true;
            useBrowserStore.getState().setIsHeroSnapped(false);
            if (document.documentElement.scrollTop > 0 || document.body.scrollTop > 0) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(() => {
                window.isNavigationLocked = false;
                const heroBtn = document.getElementById('hero-play-btn');
                if (heroBtn) {
                  heroBtn.focus({ preventScroll: true });
                } else {
                  setIsNavbarExpanded(true);
                }
              }, 400);
            }
            return;
          }
          
          // State 2 -> State 1: User is at the top, expand navbar
          console.log('[KeyboardHandler] Back key: State 2 -> 1. Expanding navbar.');
          setIsNavbarExpanded(true);
          return;
        }

        if (isLoginRoute || isServerSelectRoute) {
          console.log('[KeyboardHandler] Back key: On root auth route, opening exit dialog.');
          setShowExitDialog(true);
          setTimeout(() => {
             const cancelBtn = document.getElementById('exit-cancel');
             if (cancelBtn) cancelBtn.focus({ preventScroll: true });
          }, 50);
          return;
        } else if (hash.includes('/play') || path.includes('/play')) {
          // Let video player internal back capture handle it
          return;
        } else if (isColdStart) {
          console.log('[KeyboardHandler] Back key: History index is 0. Opening exit dialog.');
          setShowExitDialog(true);
          setTimeout(() => {
             const cancelBtn = document.getElementById('exit-cancel');
             if (cancelBtn) cancelBtn.focus({ preventScroll: true });
          }, 50);
          return;
        } else {
          // If in-between (e.g. user-select), naturally redirect to the previous route
          console.log('[AUTH FLOW] Back button triggered. Traversing back in router history.');
          navigateReactRouter(-1);
        }
        return;
      }

      // If we are on the player page, bypass spatial focus navigation
      if (path.startsWith('/play') || hash.startsWith('#/play')) {
        return;
      }

      // Spatial Navigation directional locking
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        window.isRepeatingKey = e.repeat;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          window.isHorizontalScrolling = true;
          if (window.horizontalScrollTimeout) clearTimeout(window.horizontalScrollTimeout);
          window.horizontalScrollTimeout = setTimeout(() => {
            window.isHorizontalScrolling = false;
          }, 300);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          // Do not block vertical D-pad navigation from recent horizontal movement.
          window.isVerticalScrolling = true;
          if (window.verticalScrollTimeout) clearTimeout(window.verticalScrollTimeout);
          window.verticalScrollTimeout = setTimeout(() => {
            if (!window.isVerticalScrollAnimating) {
              window.isVerticalScrolling = false;
            }
          }, 300);
        }
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          spatialNavigate('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          spatialNavigate('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          spatialNavigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (isNavbarExpanded) {
            setIsNavbarExpanded(false);
          } else {
            spatialNavigate('down');
          }
          break;
        // Enter and Space are naturally handled by the browser on focused buttons/links, 
        // but we handle them natively in useFocusable as well.
      }
    };

    const handleKeyUp = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        window.isRepeatingKey = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase so we override routing and focus strictly
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [navigateReactRouter, spatialNavigate, showExitDialog, setShowExitDialog, isNavbarExpanded, setIsNavbarExpanded]);

  return null;
}
