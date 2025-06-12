import { useEffect, useRef, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface UseAccessibilityOptions {
  focusOnMount?: boolean;
  trapFocus?: boolean;
  announceChanges?: boolean;
  skipLinks?: Array<{ href: string; label: string }>;
}

export function useAccessibility(options: UseAccessibilityOptions = {}) {
  const { focusOnMount = false, trapFocus = false, announceChanges = false } = options;
  const elementRef = useRef<HTMLElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  // Focus management
  useEffect(() => {
    if (focusOnMount && elementRef.current) {
      elementRef.current.focus();
    }
  }, [focusOnMount]);

  // Announce changes to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.setAttribute('class', 'sr-only');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
      announceRef.current = announcer;
    }
    
    announceRef.current.textContent = message;
    
    // Clear the message after a delay to allow re-announcement
    setTimeout(() => {
      if (announceRef.current) {
        announceRef.current.textContent = '';
      }
    }, 1000);
  }, []);

  // Skip link functionality
  const skipToContent = useCallback(() => {
    const mainContent = document.querySelector('main, [role="main"], #main-content');
    if (mainContent instanceof HTMLElement) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Global keyboard shortcuts
  useHotkeys('alt+1', skipToContent, { preventDefault: true });
  useHotkeys('alt+h', () => {
    const header = document.querySelector('header, [role="banner"]');
    if (header instanceof HTMLElement) {
      header.focus();
      header.scrollIntoView({ behavior: 'smooth' });
    }
  }, { preventDefault: true });

  return {
    elementRef,
    announce,
    skipToContent,
  };
}

// Hook for managing reduced motion preferences
export function useReducedMotion() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  useEffect(() => {
    if (prefersReducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    }
  }, [prefersReducedMotion]);

  return prefersReducedMotion;
}

// Hook for managing high contrast preferences
export function useHighContrast() {
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  
  useEffect(() => {
    if (prefersHighContrast) {
      document.documentElement.classList.add('high-contrast');
    }
  }, [prefersHighContrast]);

  return prefersHighContrast;
}

// Hook for managing focus-visible support
export function useFocusVisible() {
  useEffect(() => {
    // Apply focus-visible polyfill class
    document.documentElement.classList.add('js-focus-visible');
    
    // Remove focus styles when clicking
    const handleMouseDown = () => {
      document.documentElement.classList.add('mouse-navigation');
      document.documentElement.classList.remove('keyboard-navigation');
    };
    
    // Add focus styles when using keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.documentElement.classList.add('keyboard-navigation');
        document.documentElement.classList.remove('mouse-navigation');
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
} 