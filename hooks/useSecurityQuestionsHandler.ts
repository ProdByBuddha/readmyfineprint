import { useState, useCallback, useEffect } from 'react';
import { useSecurityQuestions } from 'contexts/SecurityQuestionsContext';

interface ApiError {
  code?: string;
  requiresSecurityQuestions?: boolean;
  message?: string;
}

export function useSecurityQuestionsHandler() {
  const [showSecurityQuestionsModal, setShowSecurityQuestionsModal] = useState(false);
  const { checkSecurityQuestions, markSetupComplete } = useSecurityQuestions();

  // Listen for security questions required event
  useEffect(() => {
    const handleSecurityQuestionsRequired = () => {
      setShowSecurityQuestionsModal(true);
    };

    window.addEventListener('securityQuestionsRequired', handleSecurityQuestionsRequired);
    
    return () => {
      window.removeEventListener('securityQuestionsRequired', handleSecurityQuestionsRequired);
    };
  }, []);

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
    console.log('🔐 Security questions setup completed');
    // First mark as complete to update local state immediately
    markSetupComplete();
    // Then hide modal
    setShowSecurityQuestionsModal(false);
    // Finally refresh from server to confirm
    try {
      await checkSecurityQuestions();
      console.log('✅ Security questions status refreshed from server');
    } catch (error) {
      console.error('❌ Failed to refresh security questions status:', error);
    }
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