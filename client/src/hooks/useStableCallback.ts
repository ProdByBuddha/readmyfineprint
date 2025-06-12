import { useCallback, useRef, useLayoutEffect } from 'react';

/**
 * Returns a memoized callback that never changes reference but always calls the latest version
 * Useful for preventing unnecessary re-renders in optimized components
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });
  
  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}