import { useCallback, useRef, useLayoutEffect } from 'react';

/**
 * Returns a memoized callback that never changes reference but always calls the latest version
 * Useful for preventing unnecessary re-renders in optimized components
 */
export function useStableCallback<TArgs extends unknown[], TReturn>(
  callback: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args: TArgs) => callbackRef.current(...args)), []);
}
