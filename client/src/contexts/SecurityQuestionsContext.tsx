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
      const response = await getUserSecurityQuestions();
      setHasSecurityQuestions(response.hasSecurityQuestions);
      setRequiresSetup(!response.hasSecurityQuestions);
    } catch (error) {
      console.error('Failed to check security questions:', error);
      // If we can't check, assume they don't have them set up
      setHasSecurityQuestions(false);
      setRequiresSetup(true);
    } finally {
      setIsLoading(false);
    }
  };

  const markSetupComplete = () => {
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