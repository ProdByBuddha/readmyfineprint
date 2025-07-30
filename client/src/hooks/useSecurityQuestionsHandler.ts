import { useState, useCallback } from 'react';
import { useSecurityQuestions } from '@/contexts/SecurityQuestionsContext';

interface ApiError {
  code?: string;
  requiresSecurityQuestions?: boolean;
  message?: string;
}

export function useSecurityQuestionsHandler() {
  const [showSecurityQuestionsModal, setShowSecurityQuestionsModal] = useState(false);
  const { checkSecurityQuestions, markSetupComplete } = useSecurityQuestions();

  const handleApiError = useCallback((error: any) => {
    // Check if the error indicates security questions are required
    if (error?.response?.status === 403) {
      const errorData = error.response.data as ApiError;
      if (errorData?.code === 'SECURITY_QUESTIONS_REQUIRED' || errorData?.requiresSecurityQuestions) {
        setShowSecurityQuestionsModal(true);
        return true; // Indicates we handled this error
      }
    }
    return false; // Indicates this error was not handled
  }, []);

  const handleSecurityQuestionsComplete = useCallback(async () => {
    setShowSecurityQuestionsModal(false);
    markSetupComplete();
    // Refresh security questions status
    await checkSecurityQuestions();
  }, [checkSecurityQuestions, markSetupComplete]);

  const closeSecurityQuestionsModal = useCallback(() => {
    setShowSecurityQuestionsModal(false);
  }, []);

  return {
    showSecurityQuestionsModal,
    handleApiError,
    handleSecurityQuestionsComplete,
    closeSecurityQuestionsModal,
  };
}