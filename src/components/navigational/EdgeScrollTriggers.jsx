import { useRef } from 'react';
import { useSpatialNavigation } from '../../contexts/SpatialNavigationContext';

export function EdgeScrollTriggers() {
  const { navigate } = useSpatialNavigation();
  const canScrollLeft = useRef(true);
  const canScrollRight = useRef(true);

  const scrollInterval = useRef(null);

  const scrollOneItem = (direction) => {
    if (window.isVerticalScrollAnimating) return;

    window.isHorizontalScrolling = true;
    if (window.horizontalScrollTimeout) clearTimeout(window.horizontalScrollTimeout);
    window.horizontalScrollTimeout = setTimeout(() => {
      window.isHorizontalScrolling = false;
    }, 350);

    // console.log(`[EdgeScroll] Cursor hit ${direction} edge. Scrolling...`);

    if (direction === 'left') {
      navigate('left');
    } else {
      navigate('right');
    }
  };

  const handleMouseEnter = (direction) => {
    scrollOneItem(direction);

    if (scrollInterval.current) clearInterval(scrollInterval.current);
    scrollInterval.current = setInterval(() => {
      scrollOneItem(direction);
    }, 500); // Scroll one item every 500ms while cursor stays at the edge
  };

  const handleMouseLeave = (direction) => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  return (
    <>
      <div
        className="scroll-trigger-left"
        onMouseEnter={() => handleMouseEnter('left')}
        onMouseLeave={() => handleMouseLeave('left')}
      />
      <div
        className="scroll-trigger-right"
        onMouseEnter={() => handleMouseEnter('right')}
        onMouseLeave={() => handleMouseLeave('right')}
      />
    </>
  );
}