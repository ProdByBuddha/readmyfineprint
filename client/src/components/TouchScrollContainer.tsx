import { useEffect, useRef, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface TouchScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  enablePullToRefresh?: boolean;
}

export const TouchScrollContainer = forwardRef<HTMLDivElement, TouchScrollContainerProps>(
  ({ children, className, enablePullToRefresh = false, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = ref || containerRef;

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Enhance touch scrolling performance
      const enhanceScrolling = () => {
        (container.style as any).webkitOverflowScrolling = 'touch';
        container.style.overscrollBehavior = 'none';
        container.style.transform = 'translateZ(0)';
        container.style.willChange = 'scroll-position';
      };

      // Optimize scroll performance on mobile
      let isScrolling = false;
      let scrollTimeout: NodeJS.Timeout;

      const handleScroll = () => {
        if (!isScrolling) {
          // First scroll event - enable GPU acceleration
          container.style.pointerEvents = 'none';
          isScrolling = true;
        }

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          // Scrolling finished - restore pointer events
          container.style.pointerEvents = 'auto';
          isScrolling = false;
        }, 150);
      };

      // Passive touch event listeners for better performance
      const touchStartHandler = (e: TouchEvent) => {
        // Store initial touch position for momentum calculation
        const touch = e.touches[0];
        container.dataset.touchStartY = touch.clientY.toString();
        container.dataset.scrollTop = container.scrollTop.toString();
      };

      const touchMoveHandler = (e: TouchEvent) => {
        // Allow native scrolling behavior
        const touch = e.touches[0];
        const startY = parseFloat(container.dataset.touchStartY || '0');
        const initialScrollTop = parseFloat(container.dataset.scrollTop || '0');
        
        // Calculate scroll delta
        const deltaY = startY - touch.clientY;
        const newScrollTop = initialScrollTop + deltaY;
        
        // Ensure smooth scrolling within bounds
        if (newScrollTop >= 0 && newScrollTop <= container.scrollHeight - container.clientHeight) {
          container.scrollTop = newScrollTop;
        }
      };

      enhanceScrolling();
      
      // Add event listeners with passive flag for better performance
      container.addEventListener('scroll', handleScroll, { passive: true });
      container.addEventListener('touchstart', touchStartHandler, { passive: true });
      
      if (!enablePullToRefresh) {
        container.addEventListener('touchmove', touchMoveHandler, { passive: true });
      }

      return () => {
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('touchstart', touchStartHandler);
        if (!enablePullToRefresh) {
          container.removeEventListener('touchmove', touchMoveHandler);
        }
        clearTimeout(scrollTimeout);
      };
    }, [enablePullToRefresh]);

    return (
      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className={cn(
          'overflow-y-auto overflow-x-hidden',
          // Touch scrolling optimizations
          'touch-pan-y',
          // Smooth scrolling behavior
          'scroll-smooth',
          // Hardware acceleration
          'transform-gpu',
          className
        )}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
          transform: 'translateZ(0)',
          willChange: 'scroll-position',
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TouchScrollContainer.displayName = 'TouchScrollContainer';