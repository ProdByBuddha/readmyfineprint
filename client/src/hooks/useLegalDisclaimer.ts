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

  // Check if user is authenticated (either regular user or subscription session)
  const isAuthenticated = useCallback(async () => {
    try {
      // First check for subscription token (subscription-only sessions)
      const hasSubscriptionToken = document.cookie.includes('subscriptionToken') || 
                                   document.cookie.includes('subscription_token') ||
                                   localStorage.getItem('jwt_access_token') || 
                                   localStorage.getItem('jwt_refresh_token') ||
                                   localStorage.getItem('jwt_token');
      
      // If no subscription token, check for regular user session
      if (!hasSubscriptionToken) {
        try {
          const response = await sessionFetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            return data.authenticated && data.user;
          } else if (response.status === 401) {
            // 401 means no authentication - this is normal for anonymous users
            return false;
          }
        } catch (error) {
          console.log('Session check failed, assuming unauthenticated:', error);
          return false;
        }
      }
      
      // For subscription-only sessions, we can't fetch user preferences
      // Return false to use localStorage instead
      return false;
    } catch (error) {
      // Don't log 401 errors as warnings - they're expected for subscription-only sessions
      if (error instanceof Error && !error.message.includes('401')) {
        console.warn('Failed to check authentication status:', error);
      }
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
      } else if (response.status === 401) {
        // 401 is expected for subscription-only sessions - don't log as error
        return null;
      } else if (response.status === 429) {
        // Rate limited - fall back to localStorage
        console.log('Rate limited loading disclaimer from database, using localStorage');
        return null;
      }
      return null;
    } catch (error) {
      // Don't log 401 errors as warnings - they're expected for subscription-only sessions
      if (error instanceof Error && !error.message.includes('401')) {
        console.warn('Failed to load legal disclaimer from database:', error);
      }
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
        if (response.status === 429) {
          // Rate limited - this is not critical, just log and continue
          console.log('Rate limited saving disclaimer to database, saved to localStorage only');
          return true; // Return true so we don't show an error to the user
        } else if (response.status === 401) {
          // Unauthorized - expected for subscription-only sessions
          return true; // Return true so we don't show an error to the user
        }
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
    // Prevent multiple simultaneous initializations
    if (state.loading) {
      return;
    }
    
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
    const initialize = async () => {
      // In development, wait for auto-login to complete before initializing
      if (import.meta.env.DEV) {
        // Wait for auto-login to finish
        let attempts = 0;
        while ((window as any).isAutoLoginInProgress && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        // Give additional time for session to be established
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      initializeDisclaimer();
    };
    
    initialize();
  }, [initializeDisclaimer]);

  // Listen for authentication changes
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout;
    
    const handleAuthChange = () => {
      // Debounce auth change events to prevent rapid successive calls
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        initializeDisclaimer();
      }, 1000); // Wait 1 second before re-initializing
    };

    window.addEventListener('authStateChanged', handleAuthChange);
    window.addEventListener('authUpdate', handleAuthChange);

    return () => {
      clearTimeout(debounceTimeout);
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