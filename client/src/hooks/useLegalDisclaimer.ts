import { useState, useEffect, useCallback } from 'react';
import { sessionFetch } from '../lib/api';

interface LegalDisclaimerState {
  accepted: boolean;
  loading: boolean;
  error: string | null;
}

export function useLegalDisclaimer() {
  const [state, setState] = useState<LegalDisclaimerState>({
    accepted: false,
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
  }, []);

  // Load disclaimer acceptance from database
  const loadFromDatabase = useCallback(async () => {
    try {
      const response = await sessionFetch('/api/user/preferences/legal-disclaimer', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return data.accepted;
      }
      return null;
    } catch (error) {
      console.warn('Failed to load legal disclaimer from database:', error);
      return null;
    }
  }, []);

  // Save disclaimer acceptance to database
  const saveToDatabase = useCallback(async (accepted: boolean) => {
    try {
      const response = await sessionFetch('/api/user/preferences/legal-disclaimer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ accepted })
      });

      if (!response.ok) {
        throw new Error('Failed to save legal disclaimer to database');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to save legal disclaimer to database:', error);
      return false;
    }
  }, []);

  // Initialize disclaimer state
  const initializeDisclaimer = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // For authenticated users, try to load from database
        const dbAccepted = await loadFromDatabase();
        
        if (dbAccepted !== null) {
          // Use database value
          setState(prev => ({ ...prev, accepted: dbAccepted, loading: false }));
        } else {
          // No database value, check localStorage and migrate
          const localAccepted = localStorage.getItem('readmyfineprint-disclaimer-accepted') === 'true';
          
          // Save to database
          if (localAccepted) {
            const saved = await saveToDatabase(localAccepted);
            
            if (saved) {
              console.log('✅ Legal disclaimer acceptance migrated to database:', localAccepted);
            }
          }
          
          setState(prev => ({ ...prev, accepted: localAccepted, loading: false }));
        }
      } else {
        // For unauthenticated users, use localStorage
        const localAccepted = localStorage.getItem('readmyfineprint-disclaimer-accepted') === 'true';
        setState(prev => ({ ...prev, accepted: localAccepted, loading: false }));
      }
    } catch (error) {
      console.error('Failed to initialize legal disclaimer:', error);
      // Fallback to localStorage
      const localAccepted = localStorage.getItem('readmyfineprint-disclaimer-accepted') === 'true';
      setState(prev => ({ 
        ...prev, 
        accepted: localAccepted, 
        loading: false,
        error: 'Failed to sync with database, using local storage'
      }));
    }
  }, [isAuthenticated, loadFromDatabase, saveToDatabase]);

  // Accept disclaimer
  const acceptDisclaimer = useCallback(async () => {
    // Immediately update UI
    setState(prev => ({ ...prev, accepted: true }));
    
    // Always save to localStorage for backup
    const acceptanceDate = new Date().toISOString();
    localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
    localStorage.setItem('readmyfineprint-disclaimer-date', acceptanceDate);
    
    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // Also save to database for authenticated users
        const saved = await saveToDatabase(true);
        
        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync disclaimer acceptance to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to save disclaimer acceptance:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Disclaimer saved locally but failed to sync to database'
      }));
    }
  }, [isAuthenticated, saveToDatabase]);

  // Revoke disclaimer (for testing/admin purposes)
  const revokeDisclaimer = useCallback(async () => {
    // Immediately update UI
    setState(prev => ({ ...prev, accepted: false }));
    
    // Remove from localStorage
    localStorage.removeItem('readmyfineprint-disclaimer-accepted');
    localStorage.removeItem('readmyfineprint-disclaimer-date');
    
    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // Also update database for authenticated users
        const saved = await saveToDatabase(false);
        
        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync disclaimer revocation to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to revoke disclaimer:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Disclaimer revoked locally but failed to sync to database'
      }));
    }
  }, [isAuthenticated, saveToDatabase]);

  // Initialize on mount
  useEffect(() => {
    initializeDisclaimer();
  }, [initializeDisclaimer]);

  // Listen for authentication changes
  useEffect(() => {
    const handleAuthChange = () => {
      // Re-initialize when auth state changes
      initializeDisclaimer();
    };

    window.addEventListener('authStateChanged', handleAuthChange);
    window.addEventListener('authUpdate', handleAuthChange);

    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('authUpdate', handleAuthChange);
    };
  }, [initializeDisclaimer]);

  return {
    accepted: state.accepted,
    loading: state.loading,
    error: state.error,
    acceptDisclaimer,
    revokeDisclaimer
  };
} 