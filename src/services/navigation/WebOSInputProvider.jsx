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
      const scrollTarget = document.scrollingElement || document.documentElement;
      const current = scrollTarget.scrollTop;
      const diff = targetScroll.current - current;

      if (Math.abs(diff) > 0.5) {
        window.isVerticalScrolling = true; // Lock horizontal scrolling
        scrollTarget.scrollTop = current + diff * 0.085;
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        scrollTarget.scrollTop = targetScroll.current;
        animationFrame.current = null;
        window.isVerticalScrolling = false; // Unlock horizontal scrolling
      }
    };

    const handleWheel = (e) => {
      // Only intercept primarily vertical scrolling
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
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

      targetScroll.current = target;
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

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel, { passive: false });
      window.removeEventListener('keydown', handleKeyDown);
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