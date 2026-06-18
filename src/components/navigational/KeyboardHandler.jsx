// KeyboardHandler.jsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSpatialNavigation } from '../../contexts/SpatialNavigationContext';
import { useAppStore } from '../../stores/AppStore';
import { useBrowserStore } from '../../stores/browserStore';

export function KeyboardHandler() {
  const { navigate: spatialNavigate, showExitDialog, setShowExitDialog, isNavbarExpanded, setIsNavbarExpanded } = useSpatialNavigation();
  const navigateReactRouter = useNavigate();
  const location = useLocation();

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

          const activeEl = document.activeElement;
          const currentId = activeEl?.id || '';

          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Toggle focus state between Cancel and Yes buttons
            const nextId = currentId === 'exit-exit' ? 'exit-cancel' : 'exit-exit';
            const nextEl = document.getElementById(nextId);
            if (nextEl) nextEl.focus({ preventScroll: true });
          } else if (e.key === 'Enter' || e.key === ' ') {
            if (currentId === 'exit-exit') {
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

        if (isLoginRoute || isServerSelectRoute || isHomeRoute || (isColdStart && (isUserSelectRoute || isLibrarySelectRoute))) {
          console.log('[AUTH FLOW] Back button triggered on entry/exit route or cold start. Handling Navbar/Exit.');
          if (!isNavbarExpanded) {
            setIsNavbarExpanded(true);
            // Focus the active item on expansion
            setTimeout(() => {
              const activeTab = useBrowserStore.getState().activeTab;
              let targetId = 'nav-home';
              if (activeTab?.type === 'settings') {
                targetId = 'nav-settings';
              } else if (activeTab?.type === 'library' && activeTab?.data) {
                const lib = activeTab.data;
                const uid = lib.serverClientId ? `${lib.serverClientId}-${lib.id}` : `own-${lib.id}`;
                targetId = `nav-lib-${uid}`;
              }
              const activeEl = document.getElementById(targetId);
              if (activeEl) {
                activeEl.focus({ preventScroll: true });
              } else {
                const navHome = document.getElementById('nav-home');
                if (navHome) navHome.focus({ preventScroll: true });
              }
            }, 100);
          } else {
            setIsNavbarExpanded(false);
            setShowExitDialog(true);
            setTimeout(() => {
               const cancelBtn = document.getElementById('exit-cancel');
               if (cancelBtn) cancelBtn.focus({ preventScroll: true });
            }, 100);
          }
        } else if (hash.includes('/play') || path.includes('/play')) {
          // Let video player internal back capture handle it
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
          spatialNavigate('down');
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
