import { useEffect, useRef, useCallback, useState } from 'react';
import { useSpatialNavigation } from '../contexts/SpatialNavigationContext';

export function useFocusable({ id, onFocus, onBlur, onClick }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const { registerNode, unregisterNode, setNavigationMode, lastRemoteActionRef, lastNavDirectionRef } = useSpatialNavigation();

  useEffect(() => {
    const node = ref.current;
    if (node && id) {
      registerNode(id, node);
    }
    return () => {
      if (id) unregisterNode(id);
    };
  }, [id, registerNode, unregisterNode]);

  const handleFocus = useCallback((e) => {
    setFocused(true);
    if (onFocus) onFocus(e);

    const adjustScroll = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        
        // Vertical scroll handling (page level)
        // Only auto-center vertically if the user used the remote/D-pad UP or DOWN.
        const isRemoteAction = Date.now() - lastRemoteActionRef.current <= 500;
        if (isRemoteAction && (lastNavDirectionRef.current === 'up' || lastNavDirectionRef.current === 'down')) {
          const isVisible = rect.top >= 100 && rect.bottom <= window.innerHeight - 100;

          if (!isVisible) {
            const scrollTarget = document.scrollingElement || document.documentElement;
            const targetScrollTop = scrollTarget.scrollTop + rect.top - (window.innerHeight / 2) + (rect.height / 2);
            
            if (window.setScrollTarget) {
               window.setScrollTarget(targetScrollTop);
            } else {
               window.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
            }
          }
        }

        // Horizontal scroll handling (within row)
        // Always run this on focus changes (both D-pad and hover) to pull clipped thumbnails fully into view.
        const rowContainer = ref.current.closest('.row-items');
        if (rowContainer) {
          const containerRect = rowContainer.getBoundingClientRect();
          const SAFE_MARGIN = 60; // Account for the scale(1.1) focus zoom so edge items don't clip while transitioning

          if (window.isRepeatingKey) {
            // Direct synchronous scrollLeft adjustments to prevent stale coordinate calculations during fast key repeat
            if (rect.left < containerRect.left + SAFE_MARGIN) {
              const scrollAmount = rect.left - (containerRect.left + SAFE_MARGIN) - 100;
              rowContainer.scrollLeft += scrollAmount;
            } else if (rect.right > containerRect.right - SAFE_MARGIN) {
              const scrollAmount = rect.right - (containerRect.right - SAFE_MARGIN) + 120;
              rowContainer.scrollLeft += scrollAmount;
            }
          } else {
            // Smooth asynchronous scrolling for hover / single clicks
            if (rect.left < containerRect.left + SAFE_MARGIN) {
              const scrollAmount = rect.left - (containerRect.left + SAFE_MARGIN) - 100;
              rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            } else if (rect.right > containerRect.right - SAFE_MARGIN) {
              const scrollAmount = rect.right - (containerRect.right - SAFE_MARGIN) + 120;
              rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
          }
        }
      }
    };

    if (window.isRepeatingKey) {
      adjustScroll(); // Run synchronously for key repeats
    } else {
      requestAnimationFrame(adjustScroll); // Defer for single clicks/hovers to avoid layout thrashing
    }
  }, [onFocus, lastRemoteActionRef, lastNavDirectionRef]);

  const handleBlur = useCallback((e) => {
    setFocused(false);
    if (onBlur) onBlur(e);
  }, [onBlur]);

  const handleMouseEnter = useCallback(() => {
    // Block fake hover/mouseenter events if scrolling is active,
    // but only if the cursor has been stationary (no real mousemove in last 600ms).
    // This allows active cursor hovers to focus during scroll wheel use.
    if (window.isVerticalScrolling || window.isVerticalScrollAnimating || window.isHorizontalScrolling) {
      if (!window.lastRealMouseMoveTime || Date.now() - window.lastRealMouseMoveTime > 600) {
        return;
      }
    }

    // Ignore hover if D-pad was used recently
    if (Date.now() - lastRemoteActionRef.current < 500) {
      return;
    }
    setNavigationMode('cursor');
    if (ref.current) {
      ref.current.focus({ preventScroll: true });
    }
  }, [setNavigationMode, lastRemoteActionRef]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onClick) onClick(e);
      // If no onClick provided by hook config but there is one on the element,
      // it will bubble normally or we can explicitly click it.
      if (!onClick && ref.current) {
        // Native click
      }
    }
  }, [onClick]);

  const handleClick = useCallback((e) => {
    if (onClick) onClick(e);
  }, [onClick]);

  return {
    ref,
    focused,
    props: {
      tabIndex: 0,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onMouseEnter: handleMouseEnter,
      onKeyDown: handleKeyDown,
      onClick: handleClick
    }
  };
}
