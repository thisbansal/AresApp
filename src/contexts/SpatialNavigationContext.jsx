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
    // Calculate distance between two bounding rectangles in a given direction
    // Return Infinity if rect2 is not in the specified direction of rect1
    let dx = 0;
    let dy = 0;
    
    // Centers
    const cx1 = rect1.left + rect1.width / 2;
    const cy1 = rect1.top + rect1.height / 2;
    const cx2 = rect2.left + rect2.width / 2;
    const cy2 = rect2.top + rect2.height / 2;

    switch (direction) {
      case 'up':
        if (cy2 >= cy1) return Infinity; // Not above
        dy = cy1 - cy2;
        dx = cx1 - cx2;
        break;
      case 'down':
        if (cy2 <= cy1) return Infinity; // Not below
        dy = cy2 - cy1;
        dx = cx1 - cx2;
        break;
      case 'left':
        if (cx2 >= cx1) return Infinity; // Not left
        dx = cx1 - cx2;
        dy = cy1 - cy2;
        break;
      case 'right':
        if (cx2 <= cx1) return Infinity; // Not right
        dx = cx2 - cx1;
        dy = cy1 - cy2;
        break;
      default:
        return Infinity;
    }

    // Weight the primary axis more heavily than the secondary axis
    // e.g., when moving up, vertical distance is more important than horizontal
    return Math.sqrt(Math.pow(dx, 2) * 2 + Math.pow(dy, 2) * 2);
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

    nodesRef.current.forEach((node, id) => {
      if (node === activeElement) return;
      if (!document.body.contains(node)) return;

      const nodeRect = node.getBoundingClientRect();
      // Only consider elements that have layout
      if (nodeRect.width === 0 && nodeRect.height === 0) return;

      const distance = getDistance(activeRect, nodeRect, direction);
      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });

    if (closestNode) {
      closestNode.focus({ preventScroll: true });
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
