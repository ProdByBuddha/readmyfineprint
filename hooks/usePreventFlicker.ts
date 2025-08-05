import { useLayoutEffect, useRef } from 'react';

/**
 * Prevents visual flickering by maintaining stable DOM references
 * and optimizing re-renders during navigation
 */
export function usePreventFlicker() {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      // Force browser to commit layout immediately
      void containerRef.current.offsetHeight;

      // Enable GPU acceleration for smoother transitions
      containerRef.current.style.transform = 'translateZ(0)';
      containerRef.current.style.willChange = 'transform, opacity';

      // Cleanup on unmount
      return () => {
        if (containerRef.current) {
          containerRef.current.style.willChange = 'auto';
        }
      };
    }
  }, []);

  return containerRef;
}
