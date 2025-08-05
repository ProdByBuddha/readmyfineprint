import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserSecurityQuestions } from '@/lib/api';

interface SecurityQuestionsContextType {
  hasSecurityQuestions: boolean | null;
  requiresSetup: boolean;
  isLoading: boolean;
  checkSecurityQuestions: () => Promise<void>;
  markSetupComplete: () => void;
}

const SecurityQuestionsContext = createContext<SecurityQuestionsContextType | undefined>(undefined);

export function useSecurityQuestions() {
  const context = useContext(SecurityQuestionsContext);
  if (context === undefined) {
    // During SSR or if provider is missing, return safe defaults
    if (typeof window === 'undefined') {
      return {
        hasSecurityQuestions: null,
        requiresSetup: false,
        isLoading: false,
        checkSecurityQuestions: async () => {},
        markSetupComplete: () => {}
      };
    }
    throw new Error('useSecurityQuestions must be used within a SecurityQuestionsProvider');
  }
  return context;
}

interface SecurityQuestionsProviderProps {
  children: ReactNode;
}

export function SecurityQuestionsProvider({ children }: SecurityQuestionsProviderProps) {
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);

  const checkSecurityQuestions = async () => {
    try {
      setIsLoading(true);
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        setHasSecurityQuestions(null);
        setRequiresSetup(false);
        setIsLoading(false);
        return;
      }
      
      // Check if user appears to be anonymous by looking for session indicators
      const hasSessionCookie = document.cookie.includes('session') || 
                               document.cookie.includes('auth') ||
                               document.cookie.includes('subscription');
      
      if (!hasSessionCookie) {
        console.log('👤 Anonymous user detected - skipping security questions check');
        setHasSecurityQuestions(null); // null means not applicable
        setRequiresSetup(false);
        setIsLoading(false);
        return;
      }
      
      console.log('🔍 Checking security questions status...');
      
      const response = await getUserSecurityQuestions();
      console.log('🔍 Security questions response:', {
        hasSecurityQuestions: response.hasSecurityQuestions,
        count: response.count,
        requiresSecurityQuestions: response.requiresSecurityQuestions,
        userTier: response.userTier
      });
      
      // Use server response to determine if setup is required
      if (!response.requiresSecurityQuestions) {
        console.log(`✅ ${response.userTier} tier user - security questions not required`);
        setHasSecurityQuestions(null); // null means not applicable
        setRequiresSetup(false);
      } else {
        // Paid tier user - check if they have security questions set up
        setHasSecurityQuestions(response.hasSecurityQuestions);
        setRequiresSetup(!response.hasSecurityQuestions);
      }
    } catch (error) {
      // Check if this is a 401 Unauthorized error (anonymous user)
      if (error instanceof Error && error.message.includes('401')) {
        console.log('👤 Anonymous user detected via 401 error - security questions not required');
      } else {
        console.error('Failed to check security questions:', error);
        console.log('❌ Failed to check security questions, assuming free tier');
      }
      // If we can't check, assume free tier (no setup required)
      setHasSecurityQuestions(null);
      setRequiresSetup(false);
    } finally {
      setIsLoading(false);
    }
  };

  const markSetupComplete = () => {
    console.log('✅ Marking security questions setup as complete');
    setHasSecurityQuestions(true);
    setRequiresSetup(false);
  };

  useEffect(() => {
    checkSecurityQuestions();
  }, []);

  const value: SecurityQuestionsContextType = {
    hasSecurityQuestions,
    requiresSetup,
    isLoading,
    checkSecurityQuestions,
    markSetupComplete,
  };

  return (
    <SecurityQuestionsContext.Provider value={value}>
      {children}
    </SecurityQuestionsContext.Provider>
  );
}