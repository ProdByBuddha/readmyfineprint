import { useRef, useEffect, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  resistance?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
  enabled = true
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const containerRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || window.scrollY > 0) return;
    
    touchStartY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || window.scrollY > 0 || !touchStartY.current) return;

    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - touchStartY.current;

    if (deltaY > 0) {
      // Prevent default scroll behavior when pulling down
      e.preventDefault();
      
      const distance = Math.min(deltaY / resistance, threshold * 1.5);
      setPullDistance(distance);
      
      if (distance >= threshold && !isPulling) {
        setIsPulling(true);
        // Haptic feedback simulation
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      } else if (distance < threshold && isPulling) {
        setIsPulling(false);
      }
    }
  }, [enabled, threshold, resistance, isPulling]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled) return;

    if (isPulling && pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
    touchStartY.current = 0;
    currentY.current = 0;
  }, [enabled, isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current || document.body;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    canRefresh: pullDistance >= threshold
  };
}