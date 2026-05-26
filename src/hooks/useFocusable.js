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

    // Auto-scroll logic if triggered by remote (not cursor)
    // We check if the last action was a remote action.
    if (Date.now() - lastRemoteActionRef.current > 500) {
      // It's likely a cursor action (or at least, not a recent D-pad action)
      // Do not auto-scroll the page vertically or horizontally to follow cursor focus!
      return;
    }

    // Wait for the next frame to ensure layout is updated
    requestAnimationFrame(() => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        
        // Vertical scroll handling (page level)
        // Only auto-center vertically if the user navigated UP or DOWN.
        if (lastNavDirectionRef.current === 'up' || lastNavDirectionRef.current === 'down') {
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
        // Since we use preventScroll: true on focus(), we MUST always manually scroll horizontally
        const rowContainer = ref.current.closest('.row-items');
        if (rowContainer) {
          const containerRect = rowContainer.getBoundingClientRect();
          if (rect.left < containerRect.left) {
            const scrollAmount = rect.left - containerRect.left - 100; // Extra margin for scale-up
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          } else if (rect.right > containerRect.right) {
            const scrollAmount = rect.right - containerRect.right + 120; // Extra margin for scale-up and alignment
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
        }
      }
    });
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
