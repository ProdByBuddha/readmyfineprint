
import { useEffect } from 'react';

export function useChunkErrorRecovery() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error;
      
      // Check if this is a chunk loading error
      if (
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Failed to fetch')
      ) {
        console.warn('Chunk loading error detected, attempting recovery:', error.message);
        
        // Attempt to reload the page after a short delay
        setTimeout(() => {
          if (confirm('A network error occurred while loading the page. Would you like to refresh?')) {
            window.location.reload();
          }
        }, 1000);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      // Check if this is a chunk loading promise rejection
      if (
        typeof error === 'object' &&
        error?.message?.includes('dynamically imported module')
      ) {
        console.warn('Chunk loading promise rejection detected:', error.message);
        
        // Prevent the error from bubbling up
        event.preventDefault();
        
        // Attempt recovery
        setTimeout(() => {
          if (confirm('Failed to load page content. Would you like to refresh?')) {
            window.location.reload();
          }
        }, 1000);
      }
    };

    // Add event listeners
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
}
