import { useState, useEffect, useCallback } from 'react';
import { sessionFetch } from '../lib/api';
import { generateDeviceFingerprint } from '../utils/deviceFingerprint';

interface DeviceFingerprintState {
  fingerprint: string;
  loading: boolean;
  error: string | null;
  synced: boolean; // Whether fingerprint is synced with database
}

export function useDeviceFingerprint() {
  const [state, setState] = useState<DeviceFingerprintState>({
    fingerprint: '',
    loading: true,
    error: null,
    synced: false
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

  // Load device fingerprint backup from database
  const loadBackupFromDatabase = useCallback(async () => {
    try {
      const response = await sessionFetch('/api/user/preferences/device-fingerprint', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return data.fingerprint;
      }
      return null;
    } catch (error) {
      console.warn('Failed to load device fingerprint backup from database:', error);
      return null;
    }
  }, []);

  // Save device fingerprint backup to database
  const saveBackupToDatabase = useCallback(async (fingerprint: string) => {
    try {
      const response = await sessionFetch('/api/user/preferences/device-fingerprint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ fingerprint })
      });

      if (!response.ok) {
        throw new Error('Failed to save device fingerprint backup to database');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to save device fingerprint backup to database:', error);
      return false;
    }
  }, []);

  // Get or generate device fingerprint from localStorage
  const getOrGenerateLocalFingerprint = useCallback(() => {
    try {
      const stored = localStorage.getItem('deviceFingerprint');
      if (stored && stored.startsWith('fp_')) {
        return stored;
      }
      
      const newFingerprint = generateDeviceFingerprint();
      localStorage.setItem('deviceFingerprint', newFingerprint);
      return newFingerprint;
    } catch (error) {
      console.warn('Failed to access localStorage for device fingerprint:', error);
      // Generate a session-only fingerprint
      return generateDeviceFingerprint();
    }
  }, []);

  // Initialize device fingerprint
  const initializeDeviceFingerprint = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Always start with localStorage as primary
      const localFingerprint = getOrGenerateLocalFingerprint();
      
      // Update state with local fingerprint first
      setState(prev => ({ 
        ...prev, 
        fingerprint: localFingerprint,
        loading: false,
        synced: false 
      }));

      // Try to sync with database if authenticated
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        try {
          // Load backup from database
          const dbFingerprint = await loadBackupFromDatabase();
          
          if (dbFingerprint) {
            // Database has a backup
            if (dbFingerprint !== localFingerprint) {
              console.log('📱 Device fingerprint mismatch - using localStorage version');
              // Keep localStorage version but update database backup
              const saved = await saveBackupToDatabase(localFingerprint);
              setState(prev => ({ 
                ...prev, 
                synced: saved,
                error: saved ? null : 'Failed to sync fingerprint backup'
              }));
            } else {
              // Fingerprints match
              setState(prev => ({ ...prev, synced: true }));
            }
          } else {
            // No database backup, create one
            const saved = await saveBackupToDatabase(localFingerprint);
            
            if (saved) {
              console.log('✅ Device fingerprint backup created in database');
              setState(prev => ({ ...prev, synced: true }));
            } else {
              setState(prev => ({ 
                ...prev, 
                synced: false,
                error: 'Failed to create fingerprint backup'
              }));
            }
          }
        } catch (error) {
          console.warn('Failed to sync device fingerprint with database:', error);
          setState(prev => ({ 
            ...prev, 
            synced: false,
            error: 'Failed to sync with database'
          }));
        }
      }
    } catch (error) {
      console.error('Failed to initialize device fingerprint:', error);
      // Fallback to generated fingerprint
      const fallbackFingerprint = generateDeviceFingerprint();
      setState(prev => ({ 
        ...prev, 
        fingerprint: fallbackFingerprint,
        loading: false,
        synced: false,
        error: 'Failed to initialize fingerprint'
      }));
    }
  }, [isAuthenticated, getOrGenerateLocalFingerprint, loadBackupFromDatabase, saveBackupToDatabase]);

  // Regenerate device fingerprint (for testing/privacy purposes)
  const regenerateFingerprint = useCallback(async () => {
    try {
      const newFingerprint = generateDeviceFingerprint();
      
      // Update localStorage
      localStorage.setItem('deviceFingerprint', newFingerprint);
      
      // Update state
      setState(prev => ({ ...prev, fingerprint: newFingerprint, synced: false }));
      
      // Try to update database backup if authenticated
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        const saved = await saveBackupToDatabase(newFingerprint);
        setState(prev => ({ 
          ...prev, 
          synced: saved,
          error: saved ? null : 'Failed to sync new fingerprint'
        }));
      }
      
      console.log('🔄 Device fingerprint regenerated:', newFingerprint);
    } catch (error) {
      console.error('Failed to regenerate device fingerprint:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to regenerate fingerprint'
      }));
    }
  }, [isAuthenticated, saveBackupToDatabase]);

  // Force sync with database
  const forceSyncWithDatabase = useCallback(async () => {
    try {
      const authenticated = await isAuthenticated();
      
      if (!authenticated) {
        setState(prev => ({ 
          ...prev, 
          error: 'Must be authenticated to sync with database'
        }));
        return false;
      }
      
      const saved = await saveBackupToDatabase(state.fingerprint);
      
      setState(prev => ({ 
        ...prev, 
        synced: saved,
        error: saved ? null : 'Failed to sync with database'
      }));
      
      return saved;
    } catch (error) {
      console.error('Failed to force sync with database:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to sync with database'
      }));
      return false;
    }
  }, [isAuthenticated, saveBackupToDatabase, state.fingerprint]);

  // Initialize on mount
  useEffect(() => {
    initializeDeviceFingerprint();
  }, [initializeDeviceFingerprint]);

  // Listen for authentication changes
  useEffect(() => {
    const handleAuthChange = () => {
      // Re-sync when auth state changes
      initializeDeviceFingerprint();
    };

    window.addEventListener('authStateChanged', handleAuthChange);
    window.addEventListener('authUpdate', handleAuthChange);

    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('authUpdate', handleAuthChange);
    };
  }, [initializeDeviceFingerprint]);

  return {
    fingerprint: state.fingerprint,
    loading: state.loading,
    error: state.error,
    synced: state.synced,
    regenerateFingerprint,
    forceSyncWithDatabase,
    // Legacy compatibility
    getStoredDeviceFingerprint: () => state.fingerprint
  };
} 