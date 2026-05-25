import { useRef } from 'react';
import { useSpatialNavigation } from '../../contexts/SpatialNavigationContext';

export function EdgeScrollTriggers() {
  const { navigate } = useSpatialNavigation();
  const canScrollLeft = useRef(true);
  const canScrollRight = useRef(true);

  const scrollOneItem = (direction) => {
    if (direction === 'left' && !canScrollLeft.current) return;
    if (direction === 'right' && !canScrollRight.current) return;

    if (direction === 'left') {
      canScrollLeft.current = false;
      navigate('left');
    } else {
      canScrollRight.current = false;
      navigate('right');
    }
  };

  const handleMouseEnter = (direction) => {
    scrollOneItem(direction);
  };

  const handleMouseLeave = (direction) => {
    if (direction === 'left') {
      canScrollLeft.current = true;
    } else {
      canScrollRight.current = true;
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