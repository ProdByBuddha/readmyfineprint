import { useState, useEffect, useCallback } from 'react';
import { sessionFetch } from '../lib/api';

interface CookieConsentSettings {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface CookieConsentState {
  settings: CookieConsentSettings;
  isAccepted: boolean;
  loading: boolean;
  error: string | null;
}

const DEFAULT_SETTINGS: CookieConsentSettings = {
  necessary: true,
  analytics: false,
  marketing: false
};

export function useCookieConsent() {
  const [state, setState] = useState<CookieConsentState>({
    settings: DEFAULT_SETTINGS,
    isAccepted: false,
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

  // Load cookie consent from database
  const loadFromDatabase = useCallback(async () => {
    try {
      const response = await sessionFetch('/api/user/preferences/cookie-consent', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return data.cookieConsent;
      }
      return null;
    } catch (error) {
      console.warn('Failed to load cookie consent from database:', error);
      return null;
    }
  }, []);

  // Save cookie consent to database
  const saveToDatabase = useCallback(async (settings: CookieConsentSettings) => {
    try {
      const response = await sessionFetch('/api/user/preferences/cookie-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to save cookie consent to database');
      }

      return true;
    } catch (error) {
      console.warn('Failed to save cookie consent to database:', error);
      return false;
    }
  }, []);

  // Get localStorage cookie consent
  const getLocalStorageConsent = useCallback(() => {
    try {
      const accepted = localStorage.getItem('cookie-consent-accepted') === 'true';
      const storedSettings = localStorage.getItem('cookie-consent-settings');

      let settings = DEFAULT_SETTINGS;
      if (storedSettings) {
        try {
          settings = JSON.parse(storedSettings);
        } catch (error) {
          console.warn('Failed to parse stored cookie settings:', error);
        }
      }

      return { accepted, settings };
    } catch (error) {
      console.warn('Failed to read localStorage cookie consent:', error);
      return { accepted: false, settings: DEFAULT_SETTINGS };
    }
  }, []);

  // Save to localStorage
  const saveToLocalStorage = useCallback((settings: CookieConsentSettings, accepted: boolean) => {
    try {
      localStorage.setItem('cookie-consent-accepted', accepted.toString());
      localStorage.setItem('cookie-consent-settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  // Initialize cookie consent
  const initializeCookieConsent = useCallback(async () => {
    // Skip initialization in development mode
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      console.log('⚠️ Development mode: Auto-accepting cookies');
      setState({
        settings: { necessary: true, analytics: true, marketing: true },
        isAccepted: true,
        loading: false,
        error: null
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // For authenticated users, try to load from database
        const dbSettings = await loadFromDatabase();

        if (dbSettings) {
          // Use database settings
          const isAccepted = dbSettings.necessary || dbSettings.analytics || dbSettings.marketing;
          setState(prev => ({ 
            ...prev, 
            settings: dbSettings, 
            isAccepted,
            loading: false 
          }));
        } else {
          // No database settings, check localStorage and migrate
          const { accepted, settings } = getLocalStorageConsent();

          // Save to database if accepted
          if (accepted) {
            const saved = await saveToDatabase(settings);

            if (saved) {
              console.log('✅ Cookie consent migrated to database:', settings);
            }
          }

          setState(prev => ({ 
            ...prev, 
            settings, 
            isAccepted: accepted,
            loading: false 
          }));
        }
      } else {
        // For unauthenticated users, use localStorage
        const { accepted, settings } = getLocalStorageConsent();
        setState(prev => ({ 
          ...prev, 
          settings, 
          isAccepted: accepted,
          loading: false 
        }));
      }
    } catch (error) {
      console.error('Failed to initialize cookie consent:', error);
      // Fallback to localStorage
      const { accepted, settings } = getLocalStorageConsent();
      setState(prev => ({ 
        ...prev, 
        settings, 
        isAccepted: accepted,
        loading: false,
        error: 'Failed to sync with database, using local storage'
      }));
    }
  }, [isAuthenticated, loadFromDatabase, saveToDatabase, getLocalStorageConsent]);

  // Accept all cookies
  const acceptAllCookies = useCallback(async () => {
    const allAcceptedSettings: CookieConsentSettings = {
      necessary: true,
      analytics: true,
      marketing: true
    };

    // Immediately update UI
    setState(prev => ({ 
      ...prev, 
      settings: allAcceptedSettings, 
      isAccepted: true 
    }));

    // Always save to localStorage for backup
    saveToLocalStorage(allAcceptedSettings, true);

    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // Also save to database for authenticated users
        const saved = await saveToDatabase(allAcceptedSettings);

        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync cookie consent to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to save cookie consent:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Cookie consent saved locally but failed to sync to database'
      }));
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('consentChanged'));
  }, [isAuthenticated, saveToDatabase, saveToLocalStorage]);

  // Accept specific cookie categories
  const acceptCookies = useCallback(async (settings: CookieConsentSettings) => {
    const isAccepted = settings.necessary || settings.analytics || settings.marketing;

    // Immediately update UI
    setState(prev => ({ 
      ...prev, 
      settings, 
      isAccepted 
    }));

    // Always save to localStorage for backup
    saveToLocalStorage(settings, isAccepted);

    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // Also save to database for authenticated users
        const saved = await saveToDatabase(settings);

        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync cookie consent to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to save cookie consent:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Cookie consent saved locally but failed to sync to database'
      }));
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('consentChanged'));
  }, [isAuthenticated, saveToDatabase, saveToLocalStorage]);

  // Revoke all cookies
  const revokeCookies = useCallback(async () => {
    const revokedSettings: CookieConsentSettings = {
      necessary: true, // Necessary cookies can't be revoked
      analytics: false,
      marketing: false
    };

    // Immediately update UI
    setState(prev => ({ 
      ...prev, 
      settings: revokedSettings, 
      isAccepted: false 
    }));

    // Remove from localStorage
    localStorage.removeItem('cookie-consent-accepted');
    localStorage.removeItem('cookie-consent-settings');

    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // Also update database for authenticated users
        const saved = await saveToDatabase(revokedSettings);

        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync cookie revocation to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to revoke cookies:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Cookies revoked locally but failed to sync to database'
      }));
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('consentRevoked'));
  }, [isAuthenticated, saveToDatabase]);

  // Initialize on mount
  useEffect(() => {
    initializeCookieConsent();
  }, [initializeCookieConsent]);

  // Listen for authentication changes
  useEffect(() => {
    const handleAuthChange = () => {
      // Re-initialize when auth state changes
      initializeCookieConsent();
    };

    window.addEventListener('authStateChanged', handleAuthChange);
    window.addEventListener('authUpdate', handleAuthChange);

    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('authUpdate', handleAuthChange);
    };
  }, [initializeCookieConsent]);

  return {
    settings: state.settings,
    isAccepted: state.isAccepted,
    loading: state.loading,
    error: state.error,
    acceptAllCookies,
    acceptCookies,
    revokeCookies,
    // Convenience methods
    hasAnalytics: state.settings.analytics,
    hasMarketing: state.settings.marketing,
    // Legacy compatibility
    acceptAll: acceptAllCookies,
    revokeConsent: revokeCookies
  };
}