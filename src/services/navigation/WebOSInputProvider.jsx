// WebOSInputProvider.jsx
import { createContext, useContext, useEffect, useRef } from 'react';

const WebOSInputContext = createContext();

export function WebOSInputProvider({ children }) {
  const targetScroll = useRef(0);
  const animationFrame = useRef(null);
  const isVerticalScrollLocked = useRef(false);

  useEffect(() => {
    const scrollTarget = document.scrollingElement || document.documentElement;
    targetScroll.current = scrollTarget.scrollTop;

    const animate = () => {
      if (window.isNavigationLocked) {
        animationFrame.current = null;
        window.isVerticalScrolling = false;
        window.isVerticalScrollAnimating = false;
        return;
      }
      const scrollTarget = document.scrollingElement || document.documentElement;
      const current = scrollTarget.scrollTop;
      const diff = targetScroll.current - current;

      if (Math.abs(diff) > 2.0) {
        window.isVerticalScrolling = true; // Lock horizontal scrolling
        window.isVerticalScrollAnimating = true;
        
        let step = diff * 0.085;
        if (Math.abs(step) < 0.5) {
          step = Math.sign(diff) * 0.5;
        }
        
        scrollTarget.scrollTop = current + step;
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        scrollTarget.scrollTop = targetScroll.current;
        animationFrame.current = null;
        window.isVerticalScrolling = false; // Unlock horizontal scrolling
        window.isVerticalScrollAnimating = false;
      }
    };

    const handleWheel = (e) => {
      // Only intercept primarily vertical scrolling
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // If the Intent Navigation Engine is currently locked (e.g. Snap Down/Up is animating), 
        // abort entirely so we don't fight it!
        if (window.isNavigationLocked) {
          targetScroll.current = document.scrollingElement.scrollTop || document.documentElement.scrollTop;
          return;
        }

        // Don't intercept if scrolling inside an internal scroll container
        const scrollContainer = e.target && e.target.closest ? e.target.closest('.stream-menu-popover, .nav-scroll-container, .settings-content-area') : null;
        if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
          return;
        }

        e.preventDefault();
        
        // If horizontal scrolling is active, block vertical scrolling
        if (window.isHorizontalScrolling) {
          return;
        }

        // Unlock scroll when wheel is used
        isVerticalScrollLocked.current = false;
        
        const scrollTarget = document.scrollingElement || document.documentElement;

        // Resync targetScroll if we aren't currently animating
        // because native focus() might have moved the page!
        if (!animationFrame.current) {
           targetScroll.current = scrollTarget.scrollTop;
        }

        targetScroll.current = Math.max(
          0,
          Math.min(
            scrollTarget.scrollHeight - scrollTarget.clientHeight,
            targetScroll.current + e.deltaY * 1.35
          )
        );

        if (!animationFrame.current) {
          window.isVerticalScrolling = true;
          animationFrame.current = requestAnimationFrame(animate);
        }
      }
    };

    const handleKeyDown = (e) => {
      // Unlock scroll when D-pad is used
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        isVerticalScrollLocked.current = false;
      }
    };

    // Expose methods for focus manager
    window.setScrollTarget = (target) => {
      if (isVerticalScrollLocked.current) return; // Don't scroll if locked

      const scrollTarget = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
      targetScroll.current = Math.max(0, Math.min(maxScroll, target));

      if (!animationFrame.current) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    window.lockVerticalScroll = () => {
      isVerticalScrollLocked.current = true;
    };

    window.unlockVerticalScroll = () => {
      isVerticalScrollLocked.current = false;
    };

    let lastX = 0;
    let lastY = 0;
    const handleMouseMove = (e) => {
      if (e.clientX !== lastX || e.clientY !== lastY) {
        lastX = e.clientX;
        lastY = e.clientY;
        window.lastRealMouseMoveTime = Date.now();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('wheel', handleWheel, { passive: false });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      delete window.setScrollTarget;
      delete window.lockVerticalScroll;
      delete window.unlockVerticalScroll;
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return <>{children}</>;
}

export const useWebOSInput = () => useContext(WebOSInputContext);