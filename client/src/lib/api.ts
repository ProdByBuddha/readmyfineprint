import { apiRequest } from "./queryClient";
import type { Document, UserSubscription, SubscriptionTier, SubscriptionUsage, SecurityQuestion, SecurityQuestionsSetup } from "@shared/schema";
import { getGlobalSessionId, sessionFetch, clearSession } from "./sessionManager";
import { fetchWithCSRF } from "./csrfManager";

// Export sessionFetch for use in hooks
export { sessionFetch };

// Interface for consent verification proof
interface ConsentProof {
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export async function createDocument(data: { title: string; content: string; fileType?: string }) {
  const response = await fetchWithCSRF('/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    // Try to get error message from response
    let errorMessage = `Failed to create document: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (parseError) {
      // If we can't parse the response, it might be HTML (server error)
      const responseText = await response.text();
      if (responseText.includes('<!DOCTYPE')) {
        errorMessage = 'Server error occurred. Please refresh the page and try again.';
      }
    }
    throw new Error(errorMessage);
  }

  const responseText = await response.text();
  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse JSON response:', responseText);
    throw new Error('Server returned invalid response. Please refresh the page and try again.');
  }
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchWithCSRF('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

// Security Questions API Functions

export async function getSecurityQuestions(): Promise<{ questions: SecurityQuestion[] }> {
  const response = await fetch('/api/security-questions/available', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getUserSecurityQuestions(): Promise<{ 
  questions: SecurityQuestion[], 
  hasSecurityQuestions: boolean, 
  count: number 
}> {
  const response = await fetch('/api/security-questions/user', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function setupSecurityQuestions(data: SecurityQuestionsSetup): Promise<{ 
  success: boolean, 
  message: string, 
  questionCount: number 
}> {
  const response = await fetchWithCSRF('/api/security-questions/setup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function updateSecurityQuestions(data: SecurityQuestionsSetup): Promise<{ 
  success: boolean, 
  message: string, 
  questionCount: number 
}> {
  const response = await fetchWithCSRF('/api/security-questions/update', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function verifySecurityQuestions(answers: { [questionId: string]: string }): Promise<{ 
  verified: boolean, 
  message?: string 
}> {
  const response = await fetchWithCSRF('/api/security-questions/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answers }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function deleteSecurityQuestions(): Promise<{ success: boolean, message: string }> {
  const response = await fetchWithCSRF('/api/security-questions', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function analyzeDocument(id: number): Promise<Document> {
  const headers: Record<string, string> = {};

  // Include device fingerprint if available (still needed for security)
  const deviceFingerprint = localStorage.getItem('deviceFingerprint');
  if (deviceFingerprint) {
    headers['x-device-fingerprint'] = deviceFingerprint;
  }

  const response = await apiRequest('POST', `/api/documents/${id}/analyze`, {
    headers
  });

  return response.json();
}


// Poll for document analysis completion (future feature - priority queue)
// async function pollForDocumentAnalysis(documentId: number, queueInfo: any): Promise<Document> {
//   const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
//   let attempts = 0;

//   console.log(`[Priority Queue] Document ${documentId} queued. Estimated wait: ${queueInfo.estimatedWaitTime}s`);

//   while (attempts < maxAttempts) {
//     // Wait before checking status
//     await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
//     attempts++;

//     try {
//       // Check if document analysis is complete
//       const document = await getDocument(documentId);

//       if (document.analysis) {
//         console.log(`[Priority Queue] Document ${documentId} analysis completed after ${attempts * 5} seconds`);
//         return document;
//       }

//       // Get queue status for user feedback
//       const queueStatus = await getQueueStatus();
//       console.log(`[Priority Queue] Still waiting... Queue length: ${queueStatus.queueLength}, Processing: ${queueStatus.currentlyProcessing}`);

//     } catch (error) {
//       console.error(`[Priority Queue] Error polling for document ${documentId}:`, error);
//     }
//   }

//   throw new Error("Document analysis timed out. Please try again or contact support if the issue persists.");
// }

// Get processing queue status
export async function getQueueStatus(): Promise<{
  queueLength: number;
  currentlyProcessing: number;
  concurrentLimit: number;
  queueByTier: Record<string, number>;
  userHasRequestInQueue: boolean;
  timestamp: number;
}> {
  const response = await fetch('/api/queue/status', {
    headers: {
      'x-session-id': getGlobalSessionId(),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}


export async function getDocument(documentId: number): Promise<Document> {
  const response = await fetch(`/api/documents/${documentId}`, {
    headers: {
      'x-session-id': getGlobalSessionId(),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch document');
  }

  return response.json();
}


export async function getAllDocuments(): Promise<Document[]> {
  const response = await fetch('/api/documents', {
    headers: {
      'x-session-id': getGlobalSessionId(),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }

  return response.json();
}


export async function clearAllDocuments(): Promise<{ message: string }> {
  const response = await fetchWithCSRF('/api/documents', {
    method: 'DELETE',
    headers: {},
  });

  if (!response.ok) {
    throw new Error('Failed to clear documents');
  }

  return response.json();
}


export async function logConsent(): Promise<{
  success: boolean;
  consentId?: string;
  verificationToken?: string;
  userPseudonym?: string;
  message: string
}> {
  try {
    const sessionId = getGlobalSessionId();
    console.log(`API: Logging consent with session: ${sessionId.substring(0, 16)}...`);
    
    const response = await sessionFetch('/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to log consent');
    }

    return response.json();
  } catch (error) {
    console.warn('Consent logging failed:', error);
    // Return a fallback response to not block the user
    return {
      success: false,
      message: 'Consent logging failed, but you can continue using the service'
    };
  }
}

export async function verifyUserConsent(): Promise<{
  hasConsented: boolean;
  proof: ConsentProof;
} | null> {
  try {
    const response = await fetchWithCSRF('/api/consent/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to verify consent:', error);
    return null;
  }
}

export async function verifyConsentByToken(consentId: string, verificationToken: string): Promise<{
  valid: boolean;
  proof: ConsentProof;
} | null> {
  try {
    const response = await fetchWithCSRF('/api/consent/verify-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ consentId, verificationToken }),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to verify consent by token:', error);
    return null;
  }
}

export async function logout(): Promise<{
  success: boolean;
  message: string;
  details: {
    tokensRevoked: number;
    documentsCleared: boolean;
    sessionCleared: boolean;
  };
}> {
  try {
    const response = await fetchWithCSRF('/api/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      throw new Error('Logout request failed');
    }

    const result = await response.json();
    
    // Clear any remaining local storage (for backward compatibility)
    localStorage.removeItem('subscriptionToken');
    
    // Clear session storage
    clearSession();
    
    console.log('🚪 Logout successful:', result);
    return result;
  } catch (error) {
    console.error('Failed to logout:', error);
    
    // Even if server logout fails, clear local data
    localStorage.removeItem('subscriptionToken');
    clearSession();
    
    // Return a fallback response
    return {
      success: false,
      message: 'Logout completed locally (server cleanup may have failed)',
      details: {
        tokensRevoked: 0,
        documentsCleared: false,
        sessionCleared: true
      }
    };
  }
}

export async function getConsentStats(): Promise<{
  total: number;
  unique_users: number;
  today: number;
} | null> {
  try {
    const response = await fetch('/api/consent/stats', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to get consent stats:', error);
    return null;
  }
}

export async function getUserSubscription(): Promise<{
  subscription?: UserSubscription;
  tier: SubscriptionTier;
  usage: SubscriptionUsage;
  canUpgrade: boolean;
  suggestedUpgrade?: SubscriptionTier;
}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Include device fingerprint if available (still needed for security)
  const deviceFingerprint = localStorage.getItem('deviceFingerprint');
  if (deviceFingerprint) {
    headers['x-device-fingerprint'] = deviceFingerprint;
  }

  const response = await fetch('/api/user/subscription', {
    credentials: 'include', // This sends httpOnly cookies automatically
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription data');
  }

  return response.json();
}


export async function createCustomerPortalSession(): Promise<{ url: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Include device fingerprint if available (still needed for security)
  const deviceFingerprint = localStorage.getItem('deviceFingerprint');
  if (deviceFingerprint) {
    headers['x-device-fingerprint'] = deviceFingerprint;
  }

  const response = await fetchWithCSRF('/api/subscription/customer-portal', {
    method: 'POST',
    credentials: 'include', // This sends httpOnly cookies automatically
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}


export async function reactivateSubscription(): Promise<{ success: boolean; message: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Include device fingerprint if available (still needed for security)
  const deviceFingerprint = localStorage.getItem('deviceFingerprint');
  if (deviceFingerprint) {
    headers['x-device-fingerprint'] = deviceFingerprint;
  }

  const response = await fetchWithCSRF('/api/subscription/reactivate', {
    method: 'POST',
    credentials: 'include', // This sends httpOnly cookies automatically
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// RLHF Feedback API - for improving PII detection accuracy

export interface PiiDetectionFeedbackData {
  detectionSessionId: string;
  detectedText: string;
  detectionType: string;
  detectionMethod: string;
  confidence: number;
  context?: string;
  userVote: 'correct' | 'incorrect' | 'partially_correct';
  feedbackConfidence?: number;
  feedbackReason?: string;
  documentType?: 'lease' | 'contract' | 'legal' | 'other';
  documentLength?: number;
}

/**
 * Submit feedback on PII detection accuracy
 */
export async function submitPiiDetectionFeedback(feedbackData: PiiDetectionFeedbackData) {
  const sessionId = getGlobalSessionId();
  
  const response = await fetchWithCSRF('/api/rlhf/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...feedbackData,
      sessionId
    }),
  });

  if (!response.ok) {
    let errorMessage = `Failed to submit feedback: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (parseError) {
      // If we can't parse the response, use the status text
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Get public feedback summary for displaying accuracy metrics
 */
export async function getFeedbackSummary() {
  const response = await fetch('/api/rlhf/summary', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feedback summary: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get detailed analytics (admin only)
 */
export async function getFeedbackAnalytics(params?: {
  startDate?: string;
  endDate?: string;
  detectionType?: string;
  detectionMethod?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.detectionType) searchParams.append('detectionType', params.detectionType);
  if (params?.detectionMethod) searchParams.append('detectionMethod', params.detectionMethod);

  const response = await fetchWithCSRF(`/api/rlhf/analytics?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feedback analytics: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get improvement suggestions (admin only)
 */
export async function getImprovementSuggestions() {
  const response = await fetchWithCSRF('/api/rlhf/improvements', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch improvement suggestions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Admin API helper function using session-based authentication
 */
export async function adminApiRequest(url: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Use cookie-based authentication
  const response = await fetchWithCSRF(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Admin API request failed:', response.status, errorText);
    throw new Error(`Admin API request failed: ${response.status} ${errorText}`);
  }

  return response.json();
}