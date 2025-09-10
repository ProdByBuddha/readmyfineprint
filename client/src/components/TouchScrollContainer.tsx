import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface TouchScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TouchScrollContainer = forwardRef<HTMLDivElement, TouchScrollContainerProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'overflow-y-auto overflow-x-hidden',
          className
        )}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
          transform: 'translateZ(0)',
          touchAction: 'pan-y',
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TouchScrollContainer.displayName = 'TouchScrollContainer';
