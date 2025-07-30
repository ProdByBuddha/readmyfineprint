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
      
      // First check if user needs security questions based on their subscription
      // Free tier users don't need security questions
      try {
        const subscriptionResponse = await fetch('/api/subscription/status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json();
          console.log('🔍 User subscription tier:', subscriptionData.tier);
          
          // Free tier users don't need security questions
          if (!subscriptionData.tier || subscriptionData.tier === 'free') {
            console.log('✅ Free tier user - security questions not required');
            setHasSecurityQuestions(null); // null means not applicable
            setRequiresSetup(false);
            return;
          }
        }
      } catch (subscriptionError) {
        console.log('Could not determine subscription tier, checking security questions anyway');
      }
      
      const response = await getUserSecurityQuestions();
      console.log('🔍 Security questions response:', {
        hasSecurityQuestions: response.hasSecurityQuestions,
        count: response.count
      });
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