import { useState, useEffect, useCallback } from 'react';
import { sessionFetch } from '../lib/api';

type Theme = 'light' | 'dark';

interface ThemePreferenceState {
  theme: Theme;
  loading: boolean;
  error: string | null;
}

export function useThemePreference() {
  const [state, setState] = useState<ThemePreferenceState>({
    theme: 'light',
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

  // Load theme preference from database
  const loadThemeFromDatabase = useCallback(async () => {
    try {
      const response = await sessionFetch('/api/user/preferences/theme', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return data.theme as Theme;
      }
      return null;
    } catch (error) {
      console.warn('Failed to load theme from database:', error);
      return null;
    }
  }, []);

  // Save theme preference to database
  const saveThemeToDatabase = useCallback(async (theme: Theme) => {
    try {
      const response = await sessionFetch('/api/user/preferences/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ theme })
      });

      if (!response.ok) {
        throw new Error('Failed to save theme to database');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to save theme to database:', error);
      return false;
    }
  }, []);

  // Initialize theme preference
  const initializeTheme = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // For authenticated users, try to load from database
        const dbTheme = await loadThemeFromDatabase();
        
        if (dbTheme) {
          // Use database theme
          setState(prev => ({ ...prev, theme: dbTheme, loading: false }));
        } else {
          // No database theme, check localStorage and migrate
          const localTheme = (localStorage.getItem('theme') as Theme) || 'light';
          
          // Save to database
          const saved = await saveThemeToDatabase(localTheme);
          
          if (saved) {
            console.log('✅ Theme preference migrated to database:', localTheme);
          }
          
          setState(prev => ({ ...prev, theme: localTheme, loading: false }));
        }
      } else {
        // For unauthenticated users, use localStorage
        const localTheme = (localStorage.getItem('theme') as Theme) || 'light';
        setState(prev => ({ ...prev, theme: localTheme, loading: false }));
      }
    } catch (error) {
      console.error('Failed to initialize theme preference:', error);
      // Fallback to localStorage
      const localTheme = (localStorage.getItem('theme') as Theme) || 'light';
      setState(prev => ({ 
        ...prev, 
        theme: localTheme, 
        loading: false,
        error: 'Failed to sync with database, using local storage'
      }));
    }
  }, [isAuthenticated, loadThemeFromDatabase, saveThemeToDatabase]);

  // Update theme preference
  const setTheme = useCallback(async (newTheme: Theme) => {
    // Immediately update UI
    setState(prev => ({ ...prev, theme: newTheme }));
    
    // Always save to localStorage for backup
    localStorage.setItem('theme', newTheme);
    
    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // Also save to database for authenticated users
        const saved = await saveThemeToDatabase(newTheme);
        
        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync theme to database'
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Theme saved locally but failed to sync to database'
      }));
    }
  }, [isAuthenticated, saveThemeToDatabase]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [state.theme, setTheme]);

  // Initialize on mount
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  // Listen for authentication changes
  useEffect(() => {
    const handleAuthChange = () => {
      // Re-initialize theme when auth state changes
      initializeTheme();
    };

    window.addEventListener('authStateChanged', handleAuthChange);
    window.addEventListener('authUpdate', handleAuthChange);

    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('authUpdate', handleAuthChange);
    };
  }, [initializeTheme]);

  return {
    theme: state.theme,
    setTheme,
    toggleTheme,
    loading: state.loading,
    error: state.error
  };
} 