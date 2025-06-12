import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { queryClient } from '@/lib/queryClient';

interface MobileAppWrapperProps {
  children: ReactNode;
  className?: string;
}

export function MobileAppWrapper({ children, className = '' }: MobileAppWrapperProps) {
  const isMobile = useIsMobile();

  const handleRefresh = async () => {
    // Invalidate all queries to refresh data
    await queryClient.invalidateQueries();
    
    // Small delay to show the refresh animation
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  const {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    canRefresh
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: isMobile,
    threshold: 80,
    resistance: 2.5
  });

  if (!isMobile) {
    return <div className={`${className} overflow-y-auto`}>{children}</div>;
  }

  return (
    <div 
      ref={containerRef}
      className={`relative ${className} overflow-y-auto`}
      style={{
        transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance, 100)}px)` : 'none',
        transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* Pull to refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className={`
            pull-to-refresh 
            ${canRefresh || isRefreshing ? 'active' : ''}
          `}
          style={{
            opacity: Math.min(pullDistance / 60, 1),
            transform: `translateX(-50%) scale(${Math.min(0.8 + (pullDistance / 200), 1.2)})`
          }}
        >
          <RefreshCw 
            className={`
              w-5 h-5 text-primary
              ${isRefreshing ? 'animate-spin' : canRefresh ? 'rotate-180' : ''}
            `}
            style={{
              transform: `rotate(${Math.min(pullDistance * 2, 180)}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.2s ease'
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className={isRefreshing ? 'opacity-80' : 'opacity-100'}>
        {children}
      </div>

      {/* Pull instruction hint */}
      {isPulling && !canRefresh && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-black/70 text-white text-sm px-3 py-1 rounded-full backdrop-blur-sm">
            Pull down to refresh
          </div>
        </div>
      )}

      {/* Release instruction hint */}
      {canRefresh && !isRefreshing && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-primary/90 text-white text-sm px-3 py-1 rounded-full backdrop-blur-sm">
            Release to refresh
          </div>
        </div>
      )}
    </div>
  );
}