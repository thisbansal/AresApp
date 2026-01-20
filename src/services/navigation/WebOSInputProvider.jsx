// WebOSInputProvider.jsx
import { createContext, useContext, useEffect, useRef } from 'react';

const WebOSInputContext = createContext();

export function WebOSInputProvider({ children }) {
  const targetScroll = useRef(0);
  const animationFrame = useRef(null);

  useEffect(() => {
    // Initialize target to current scroll position
    const scrollTarget = document.scrollingElement || document.documentElement;
    targetScroll.current = scrollTarget.scrollTop;

    const animate = () => {
      const scrollTarget = document.scrollingElement || document.documentElement;
      const current = scrollTarget.scrollTop;
      const diff = targetScroll.current - current;

      if (Math.abs(diff) > 0.5) {
        scrollTarget.scrollTop = current + diff * 0.085;
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        scrollTarget.scrollTop = targetScroll.current;
        animationFrame.current = null;
      }
    };

    const handleWheel = (e) => {
      const scrollTarget = document.scrollingElement || document.documentElement;

      targetScroll.current = Math.max(
        0,
        Math.min(
          scrollTarget.scrollHeight - scrollTarget.clientHeight,
          targetScroll.current + e.deltaY * 1.35
        )
      );

      if (!animationFrame.current) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    // Expose a method to set scroll target from outside
    window.setScrollTarget = (target) => {
      targetScroll.current = target;
      if (!animationFrame.current) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    window.addEventListener('wheel', handleWheel);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      delete window.setScrollTarget;
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return <>{children}</>;
}

export const useWebOSInput = () => useContext(WebOSInputContext);