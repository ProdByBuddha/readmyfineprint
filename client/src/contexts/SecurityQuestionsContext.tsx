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
      console.error('Failed to check security questions:', error);
      // If we can't check, assume free tier (no setup required)
      console.log('❌ Failed to check security questions, assuming free tier');
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