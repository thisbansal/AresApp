import { useEffect, useRef, useCallback, useState } from 'react';
import { useSpatialNavigation } from '../contexts/SpatialNavigationContext';

export function useFocusable({ id, onFocus, onBlur, onClick }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const { registerNode, unregisterNode, setNavigationMode, lastRemoteActionRef } = useSpatialNavigation();

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
    // Wait for the next frame to ensure layout is updated
    requestAnimationFrame(() => {
      if (ref.current) {
        // Vertical scroll handling (page level)
        const rect = ref.current.getBoundingClientRect();
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

        // Horizontal scroll handling (within row)
        const rowContainer = ref.current.closest('.row-items');
        if (rowContainer) {
          const containerRect = rowContainer.getBoundingClientRect();
          if (rect.left < containerRect.left) {
            const scrollAmount = rect.left - containerRect.left - 20;
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          } else if (rect.right > containerRect.right) {
            const scrollAmount = rect.right - containerRect.right + 20;
            rowContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
        }
      }
    });
  }, [onFocus]);

  const handleBlur = useCallback((e) => {
    setFocused(false);
    if (onBlur) onBlur(e);
  }, [onBlur]);

  const handleMouseEnter = useCallback(() => {
    // Ignore hover if D-pad was used recently
    if (Date.now() - lastRemoteActionRef.current < 500) {
      return;
    }
    setNavigationMode('cursor');
    if (ref.current) {
      ref.current.focus();
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
