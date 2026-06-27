import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { useBrowserStore } from '../stores/browserStore';

const SpatialNavigationContext = createContext(null);

export const SpatialNavigationProvider = ({ children }) => {
  const nodesRef = useRef(new Map());
  const [navigationMode, setNavigationMode] = useState('remote'); // 'remote' or 'cursor'
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSignoutConfirm, setShowSignoutConfirm] = useState(false);
  const [isNavbarExpanded, setIsNavbarExpanded] = useState(false);
  const [layerStack, setLayerStack] = useState(['base']);
  const layerStackRef = useRef(['base']);
  const activeLayer = layerStack.length > 0 ? layerStack[layerStack.length - 1] : 'base';

  useEffect(() => {
    layerStackRef.current = layerStack;
  }, [layerStack]);
  const lastRemoteActionRef = useRef(0);
  const lastNavDirectionRef = useRef(null);
  const focusHistoryRef = useRef({});

  const pushLayer = useCallback((layerId) => {
    // Save the currently focused element for this new layer
    if (document.activeElement && document.activeElement.tagName !== 'BODY') {
      focusHistoryRef.current[layerId] = document.activeElement;
    }
    setLayerStack(prev => [...prev.filter(id => id !== layerId), layerId]);
  }, []);

  const popLayer = useCallback((layerId) => {
    setLayerStack(prev => {
      // If we are popping the currently active layer, restore focus
      if (prev.length > 0 && prev[prev.length - 1] === layerId) {
        const toFocus = focusHistoryRef.current[layerId];
        if (toFocus && document.body.contains(toFocus)) {
          setTimeout(() => toFocus.focus({ preventScroll: true }), 50);
        }
      }
      // Cleanup the reference
      delete focusHistoryRef.current[layerId];

      const newStack = prev.filter(id => id !== layerId);
      return newStack.length > 0 ? newStack : ['base'];
    });
  }, []);

  // Global Intent-Based Wheel Listener
  useEffect(() => {
    const handleWheel = (e) => {
      // If navbar is expanded, treat it as a popover: wheel scrolls left/right, page freezes
      if (isNavbarExpanded) {
        e.preventDefault();
        if (window.wheelSnapCooldown) return;

        if (e.deltaY > 0) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        } else if (e.deltaY < 0) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        }

        window.wheelSnapCooldown = true;
        setTimeout(() => { window.wheelSnapCooldown = false; }, 150);
        return;
      }

      const state = useBrowserStore.getState();
      if (state.activeTab?.type !== 'home') return;

      if (window.isNavigationLocked || window.wheelSnapCooldown) {
        // e.preventDefault(); // Temporarily disabled preventDefault here to not spam logs, but we still return
        return;
      }

      const currentIsHeroSnapped = state.isHeroSnapped;

      // Intent: requestSnapDown
      if (!currentIsHeroSnapped && e.deltaY > 0) {
        console.log(`[Navigation Engine] Snap DOWN triggered! deltaY: ${e.deltaY}, scrollY: ${window.scrollY}`);
        e.preventDefault();
        window.isNavigationLocked = true;
        document.activeElement?.blur();
        
        state.setIsHeroSnapped(true);
        
        // Anchor Approach: scroll smoothly to the first row!
        const firstRow = document.querySelector('.row');
        if (firstRow) {
          firstRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
        }

        // Lock navigation briefly to allow smooth scroll to finish without trackpad bouncing
        setTimeout(() => {
          console.log(`[Navigation Engine] Snap DOWN completed.`);
          window.isNavigationLocked = false;
          window.wheelSnapCooldown = true;
          setTimeout(() => { window.wheelSnapCooldown = false; }, 500);
        }, 500);
      }

      // Intent: requestSnapUp
      // Trigger snap up if we are anywhere near the first row (e.g. scrollY < 1.1 * innerHeight)
      if (currentIsHeroSnapped && e.deltaY < 0 && window.scrollY < window.innerHeight * 1.1) {
        console.log(`[Navigation Engine] Snap UP triggered! deltaY: ${e.deltaY}, scrollY: ${window.scrollY}`);
        e.preventDefault();
        window.isNavigationLocked = true;
        document.activeElement?.blur();
        
        state.setIsHeroSnapped(false);
        
        // Anchor Approach: scroll smoothly back to the top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
          console.log(`[Navigation Engine] Snap UP completed.`);
          window.isNavigationLocked = false;
          const heroBtn = document.getElementById('hero-play-btn');
          if (heroBtn) heroBtn.focus({ preventScroll: true });
          window.wheelSnapCooldown = true;
          setTimeout(() => { window.wheelSnapCooldown = false; }, 500);
        }, 500);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isNavbarExpanded]);

  const registerNode = useCallback((id, node, layerId = 'base') => {
    nodesRef.current.set(id, { node, layerId });
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

    let hOverlap = 0;
    let vOverlap = 0;
    let d_primary = 0;
    let d_orthogonal = 0;

    switch (direction) {
      case 'up':
        if (cy2 >= cy1) return Infinity; // Not above
        d_primary = cy1 - cy2;
        hOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
        d_orthogonal = hOverlap > 0 ? 0 : Math.abs(cx1 - cx2);
        break;
      case 'down':
        if (cy2 <= cy1) return Infinity; // Not below
        d_primary = cy2 - cy1;
        hOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
        d_orthogonal = hOverlap > 0 ? 0 : Math.abs(cx1 - cx2);
        break;
      case 'left':
        if (cx2 >= cx1) return Infinity; // Not left
        d_primary = cx1 - cx2;
        vOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
        d_orthogonal = vOverlap > 0 ? 0 : Math.abs(cy1 - cy2);
        break;
      case 'right':
        if (cx2 <= cx1) return Infinity; // Not right
        d_primary = cx2 - cx1;
        vOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
        d_orthogonal = vOverlap > 0 ? 0 : Math.abs(cy1 - cy2);
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

    const currentActiveLayer = layerStackRef.current.length > 0 ? layerStackRef.current[layerStackRef.current.length - 1] : 'base';
    const activeElement = document.activeElement;

    // Check if the current active element is actually registered in the active layer
    let isActiveElementInActiveLayer = false;
    if (activeElement && activeElement !== document.body) {
      nodesRef.current.forEach((entry) => {
        if (entry.node === activeElement && entry.layerId === currentActiveLayer) {
          isActiveElementInActiveLayer = true;
        }
      });
    }

    if (!isActiveElementInActiveLayer) {
      // If nothing is focused OR the currently focused element is NOT in the active layer,
      // focus the first fully visible node in the active layer.
      const nodesInActiveLayer = Array.from(nodesRef.current.values()).filter(entry => entry.layerId === currentActiveLayer);
      
      const visibleNode = nodesInActiveLayer.find(entry => {
        const rect = entry.node.getBoundingClientRect();
        // Check if fully visible on screen (with a tiny buffer to avoid rounding issues)
        return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 0 && rect.height > 0;
      });

      if (visibleNode) {
        visibleNode.node.focus({ preventScroll: true });
      } else if (nodesInActiveLayer[0]) {
        nodesInActiveLayer[0].node.focus({ preventScroll: true });
      }
      return;
    }

    const activeRect = activeElement.getBoundingClientRect();
    let closestNode = null;
    let minDistance = Infinity;

    // Detect if the active element is inside a specific scroll/layout container
    let activeContainer = null;
    let activeContainerSelector = null;
    const containers = [
      '.row-items', 
      '.grid', 
      '.nav-scroll-container', 
      '.numpad',
      '.player-hud-stream-row',
      '.player-hud-controls'
    ];
    for (const selector of containers) {
      const container = activeElement.closest(selector);
      if (container) {
        activeContainer = container;
        activeContainerSelector = selector;
        break;
      }
    }

    nodesRef.current.forEach((entry, id) => {
      const { node, layerId: nodeLayerId } = entry;
      if (nodeLayerId !== currentActiveLayer) return;
      if (node === activeElement) return;
      if (!document.body.contains(node)) return;

      const computedStyle = window.getComputedStyle(node);
      if (computedStyle.opacity === '0' || computedStyle.visibility === 'hidden' || computedStyle.display === 'none') return;

      const nodeRect = node.getBoundingClientRect();
      // Only consider elements that have layout
      if (nodeRect.width === 0 || nodeRect.height === 0) return;

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

      if (window.isNavigationLocked) return;

      // Prevent browser native scroll jumping by using smooth scrollIntoView
      // Ensure we lock scroll on D-pad navigation to stop fighting with React layouts
      if (closestNode.id.startsWith('hero-') || closestNode.id.startsWith('nav-')) {
        window.isNavigationLocked = true;
        useBrowserStore.getState().setIsHeroSnapped(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => { window.isNavigationLocked = false; }, 400);
      } else if (direction === 'down' && document.activeElement?.id?.startsWith('hero-')) {
        // TUNE THIS VALUE: adjust how far the D-Pad snaps down when leaving Hero Banner
        window.isNavigationLocked = true;
        useBrowserStore.getState().setIsHeroSnapped(true);
        const firstRow = document.querySelector('.row');
        if (firstRow) {
          firstRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
        }
        setTimeout(() => { window.isNavigationLocked = false; }, 400);
      } else {
        // For everything else, center the row nicely, but avoid vertical jumping when moving horizontally
        const isHorizontal = direction === 'left' || direction === 'right';
        closestNode.scrollIntoView({ 
          behavior: 'smooth', 
          block: isHorizontal ? 'nearest' : 'center', 
          inline: 'nearest' 
        });
      }
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
  }, []); // layerStackRef guarantees we always read the latest layer synchronously without causing closure stales

  const focusLayer = useCallback((layerId) => {
    // Find the first registered node in the specified layer and focus it
    const nodesInLayer = Array.from(nodesRef.current.values()).filter(entry => entry.layerId === layerId);
    const firstNode = nodesInLayer[0]?.node;
    if (firstNode) {
      firstNode.focus({ preventScroll: true });
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
    showSignoutConfirm,
    setShowSignoutConfirm,
    isNavbarExpanded,
    setIsNavbarExpanded,
    activeLayer,
    pushLayer,
    popLayer,
    focusLayer,
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

export const LayerContext = createContext('base');

export const FocusLayer = ({ id, isActive = true, autoFocusFirst = true, children }) => {
  const { pushLayer, popLayer, focusLayer } = useSpatialNavigation();

  useEffect(() => {
    if (isActive) {
      pushLayer(id);
      if (autoFocusFirst) {
        setTimeout(() => focusLayer(id), 50);
      }
    } else {
      popLayer(id);
    }
    return () => popLayer(id);
  }, [isActive, id, pushLayer, popLayer, focusLayer, autoFocusFirst]);

  // If not active, we still provide 'base' so children don't trap focus if layer is deactivated but still mounted
  return (
    <LayerContext.Provider value={isActive ? id : 'base'}>
      {children}
    </LayerContext.Provider>
  );
};
