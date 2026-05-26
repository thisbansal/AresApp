import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const SpatialNavigationContext = createContext(null);

export const SpatialNavigationProvider = ({ children }) => {
  const nodesRef = useRef(new Map());
  const [navigationMode, setNavigationMode] = useState('remote'); // 'remote' or 'cursor'
  const [showExitDialog, setShowExitDialog] = useState(false);
  const lastRemoteActionRef = useRef(0);
  const lastNavDirectionRef = useRef(null);

  const registerNode = useCallback((id, node) => {
    nodesRef.current.set(id, node);
  }, []);

  const unregisterNode = useCallback((id) => {
    nodesRef.current.delete(id);
  }, []);

  const getDistance = (rect1, rect2, direction) => {
    // Centers
    const cx1 = rect1.left + rect1.width / 2;
    const cy1 = rect1.top + rect1.height / 2;
    const cx2 = rect2.left + rect2.width / 2;
    const cy2 = rect2.top + rect2.height / 2;

    let d_primary = 0;
    let d_orthogonal = 0;

    switch (direction) {
      case 'up':
        if (cy2 >= cy1) return Infinity; // Not above
        d_primary = cy1 - cy2;
        d_orthogonal = Math.abs(cx1 - cx2);
        break;
      case 'down':
        if (cy2 <= cy1) return Infinity; // Not below
        d_primary = cy2 - cy1;
        d_orthogonal = Math.abs(cx1 - cx2);
        break;
      case 'left':
        if (cx2 >= cx1) return Infinity; // Not left
        d_primary = cx1 - cx2;
        d_orthogonal = Math.abs(cy1 - cy2);
        break;
      case 'right':
        if (cx2 <= cx1) return Infinity; // Not right
        d_primary = cx2 - cx1;
        d_orthogonal = Math.abs(cy1 - cy2);
        break;
      default:
        return Infinity;
    }

    // Standard spatial navigation scoring formula.
    // Orthogonal distance is weighted heavily (factor of 5) to favor straight-line
    // traversal and prevent unexpected diagonal drift.
    return d_primary + d_orthogonal * 5;
  };

  const navigate = useCallback((direction) => {
    setNavigationMode('remote');
    lastRemoteActionRef.current = Date.now();
    lastNavDirectionRef.current = direction;

    const activeElement = document.activeElement;
    if (!activeElement || activeElement === document.body) {
      // If nothing is focused, focus the first registered node
      const firstNode = Array.from(nodesRef.current.values())[0];
      if (firstNode) firstNode.focus({ preventScroll: true });
      return;
    }

    const activeRect = activeElement.getBoundingClientRect();
    let closestNode = null;
    let minDistance = Infinity;

    // Detect if the active element is inside a specific scroll/layout container
    let activeContainer = null;
    let activeContainerSelector = null;
    const containers = ['.row-items', '.grid', '.nav-scroll-container', '.numpad'];
    for (const selector of containers) {
      const container = activeElement.closest(selector);
      if (container) {
        activeContainer = container;
        activeContainerSelector = selector;
        break;
      }
    }

    nodesRef.current.forEach((node, id) => {
      if (node === activeElement) return;
      if (!document.body.contains(node)) return;

      const nodeRect = node.getBoundingClientRect();
      // Only consider elements that have layout
      if (nodeRect.width === 0 && nodeRect.height === 0) return;

      // Restrict horizontal (left/right) navigation to keep focus within its active row/grid row
      if (direction === 'left' || direction === 'right') {
        if (activeContainer) {
          // Must belong to the exact same parent container (no row wrapping/drifting)
          if (node.closest(activeContainerSelector) !== activeContainer) {
            return;
          }
          // For grids, must align horizontally on the same grid line
          if (activeContainerSelector === '.grid') {
            const cy1 = activeRect.top + activeRect.height / 2;
            const cy2 = nodeRect.top + nodeRect.height / 2;
            if (Math.abs(cy1 - cy2) > 60) {
              return;
            }
          }
        }
      }

      const distance = getDistance(activeRect, nodeRect, direction);
      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });

    if (closestNode) {
      closestNode.focus({ preventScroll: true });
    } else {
      // Fallback: If we hit the boundary (no more items in that direction),
      // scroll the horizontal row-items container to the absolute end/start.
      if (direction === 'right' || direction === 'left') {
        const activeContainer = activeElement.closest('.row-items');
        if (activeContainer) {
          if (direction === 'right') {
            activeContainer.scrollTo({
              left: activeContainer.scrollWidth - activeContainer.clientWidth,
              behavior: 'smooth'
            });
          } else if (direction === 'left') {
            activeContainer.scrollTo({
              left: 0,
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }, []);

  const value = {
    registerNode,
    unregisterNode,
    navigate,
    navigationMode,
    setNavigationMode,
    showExitDialog,
    setShowExitDialog,
    lastRemoteActionRef,
    lastNavDirectionRef
  };

  return (
    <SpatialNavigationContext.Provider value={value}>
      {children}
    </SpatialNavigationContext.Provider>
  );
};

export const useSpatialNavigation = () => {
  const context = useContext(SpatialNavigationContext);
  if (!context) {
    throw new Error('useSpatialNavigation must be used within a SpatialNavigationProvider');
  }
  return context;
};
