import { useState, useEffect, useCallback } from 'react';
import { sessionFetch } from '../lib/api';

interface DonationTrackingState {
  visited: boolean;
  loading: boolean;
  error: string | null;
}

export function useDonationTracking() {
  const [state, setState] = useState<DonationTrackingState>({
    visited: false,
    loading: true,
    error: null
  });

  // Check if user is authenticated
  const isAuthenticated = useCallback(async () => {
    try {
      const response = await sessionFetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.authenticated && data.user;
      }
      return false;
    } catch (error) {
      console.warn('Failed to check authentication status:', error);
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  // Load donation tracking from database
  const loadFromDatabase = useCallback(async () => {
    try {
      const response = await sessionFetch('/api/user/preferences/donation-tracking', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return data.visited;
      }
      return null;
    } catch (error) {
      console.warn('Failed to load donation tracking from database:', error);
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  // Save donation tracking to database
  const saveToDatabase = useCallback(async (visited: boolean) => {
    try {
      const response = await sessionFetch('/api/user/preferences/donation-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ visited })
      });

      if (!response.ok) {
        throw new Error('Failed to save donation tracking to database');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to save donation tracking to database:', error);
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  // Initialize donation tracking
  const initializeDonationTracking = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // For authenticated users, try to load from database
        const dbVisited = await loadFromDatabase();
        
        if (dbVisited !== null) {
          // Use database value
          setState(prev => ({ ...prev, visited: dbVisited, loading: false }));
        } else {
          // No database value, check localStorage and migrate
          const localVisited = localStorage.getItem('donationPageVisited') === 'true';
          
          // Save to database
          if (localVisited) {
            const saved = await saveToDatabase(localVisited);
            
            if (saved) {
              console.log('✅ Donation tracking migrated to database:', localVisited);
            }
          }
          
          setState(prev => ({ ...prev, visited: localVisited, loading: false }));
        }
      } else {
        // For unauthenticated users, use localStorage
        const localVisited = localStorage.getItem('donationPageVisited') === 'true';
        setState(prev => ({ ...prev, visited: localVisited, loading: false }));
      }
    } catch (error) {
      console.error('Failed to initialize donation tracking:', error);
      // Fallback to localStorage
      const localVisited = localStorage.getItem('donationPageVisited') === 'true';
      setState(prev => ({ 
        ...prev, 
        visited: localVisited, 
        loading: false,
        error: 'Failed to sync with database, using local storage'
      }));
    }
  }, [isAuthenticated, loadFromDatabase, saveToDatabase]);

  // Mark donation page as visited
  const markAsVisited = useCallback(async () => {
    // Immediately update UI
    setState(prev => ({ ...prev, visited: true }));
    
    // Always save to localStorage for backup
    localStorage.setItem('donationPageVisited', 'true');
    
    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // Also save to database for authenticated users
        const saved = await saveToDatabase(true);
        
        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync donation tracking to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to save donation tracking:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Donation tracking saved locally but failed to sync to database'
      }));
    }
  }, [isAuthenticated, saveToDatabase]);

  // Reset donation tracking (for testing/admin purposes)
  const resetTracking = useCallback(async () => {
    // Immediately update UI
    setState(prev => ({ ...prev, visited: false }));
    
    // Remove from localStorage
    localStorage.removeItem('donationPageVisited');
    
    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // Also update database for authenticated users
        const saved = await saveToDatabase(false);
        
        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync donation tracking reset to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to reset donation tracking:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Donation tracking reset locally but failed to sync to database'
      }));
    }
  }, [isAuthenticated, saveToDatabase]);

  // Initialize on mount
  useEffect(() => {
    initializeDonationTracking();
  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  // Listen for authentication changes
  useEffect(() => {
    const handleAuthChange = () => {
      // Re-initialize when auth state changes
      initializeDonationTracking();
    };

    window.addEventListener('authStateChanged', handleAuthChange);
    window.addEventListener('authUpdate', handleAuthChange);

    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('authUpdate', handleAuthChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  return {
    visited: state.visited,
    loading: state.loading,
    error: state.error,
    markAsVisited,
    resetTracking
  };
} 