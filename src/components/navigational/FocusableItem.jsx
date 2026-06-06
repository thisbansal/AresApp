import { useFocusable } from '../../hooks/useFocusable';

export function FocusableItem({ id, rowIndex, colIndex, children, onClick, onFocus, onBlur, className = '', style = {}, ...props }) {
  // We no longer need rowIndex/colIndex for the new SpatialNavigationContext, 
  // but we accept them to avoid breaking existing code that passes them.
  
  const { ref, focused, props: focusableProps } = useFocusable({
    id,
    onFocus,
    onBlur,
    onClick
  });

  return (
    <div
      ref={ref}
      id={id}
      className={`focusable-item ${focused ? 'focused' : ''} ${className}`}
      style={{
        transform: focused ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: focused ? 10 : 1,
        ...style,
      }}
      {...focusableProps}
      {...props}
    >
      {children}
    </div>
  );
}