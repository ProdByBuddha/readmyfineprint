import { apiRequest } from "./queryClient";
import type { Document, UserSubscription, SubscriptionTier, SubscriptionUsage, SecurityQuestion, SecurityQuestionsSetup } from "@shared/schema";
import { getGlobalSessionId, sessionFetch, clearSession } from "./sessionManager";
import { fetchWithCSRF } from "./csrfManager";
import { reportApiError, reportNetworkError } from "./error-reporter";

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
  const response = await sessionFetch('/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    // Read response body once and handle different content types
    let errorMessage = `Failed to create document: ${response.statusText}`;
    try {
      const responseText = await response.text();
      
      // Try to parse as JSON first
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (jsonParseError) {
        // If not JSON, check if it's HTML (server error)
        if (responseText.includes('<!DOCTYPE')) {
          errorMessage = 'Server error occurred. Please refresh the page and try again.';
        } else if (responseText) {
          errorMessage = responseText;
        }
      }
    } catch (readError) {
      // If we can't read the response at all, use default message
      console.error('Failed to read error response:', readError);
    }
    
    // Report API error to admin
    reportApiError(new Error(errorMessage), '/api/documents', 'POST');
    
    throw new Error(errorMessage);
  }

  // Success case - read response body once
  try {
    const responseText = await response.text();
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse JSON response:', parseError);
    throw new Error('Server returned invalid response. Please refresh the page and try again.');
  }
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await sessionFetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    try {
      const responseText = await response.text();
      // Try to parse as JSON first for structured error messages
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || responseText);
      } catch (jsonParseError) {
        // If not JSON, use the raw text
        throw new Error(responseText || `Upload failed: ${response.statusText}`);
      }
    } catch (readError) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse upload response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse security questions response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
}

export async function getUserSecurityQuestions(): Promise<{ 
  questions: SecurityQuestion[], 
  hasSecurityQuestions: boolean, 
  count: number,
  requiresSecurityQuestions: boolean,
  userTier: string
}> {
  const response = await fetch('/api/security-questions/user', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getUserSecurityQuestions response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse setupSecurityQuestions response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse updateSecurityQuestions response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse verifySecurityQuestions response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
}

export async function deleteSecurityQuestions(): Promise<{ success: boolean, message: string }> {
  const response = await fetchWithCSRF('/api/security-questions', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse deleteSecurityQuestions response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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

  if (!response.ok) {
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || 'Failed to analyze document');
      } catch (jsonParseError) {
        throw new Error(responseText || 'Failed to analyze document');
      }
    } catch (readError) {
      throw new Error('Failed to analyze document');
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse analyzeDocument response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
  const response = await sessionFetch('/api/queue/status', {
    method: 'GET',
  });

  if (!response.ok) {
    try {
      const responseText = await response.text();
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    } catch (readError) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getQueueStatus response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
}


export async function getDocument(documentId: number): Promise<Document> {
  const response = await sessionFetch(`/api/documents/${documentId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || 'Failed to fetch document');
      } catch (jsonParseError) {
        throw new Error(responseText || 'Failed to fetch document');
      }
    } catch (readError) {
      throw new Error('Failed to fetch document');
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getDocument response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
}


export async function getAllDocuments(): Promise<Document[]> {
  const response = await sessionFetch('/api/documents', {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || 'Failed to fetch documents');
      } catch (jsonParseError) {
        throw new Error(responseText || 'Failed to fetch documents');
      }
    } catch (readError) {
      throw new Error('Failed to fetch documents');
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getAllDocuments response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
}


export async function clearAllDocuments(): Promise<{ message: string }> {
  const response = await sessionFetch('/api/documents', {
    method: 'DELETE',
    headers: {},
  });

  if (!response.ok) {
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || 'Failed to clear documents');
      } catch (jsonParseError) {
        throw new Error(responseText || 'Failed to clear documents');
      }
    } catch (readError) {
      throw new Error('Failed to clear documents');
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse clearAllDocuments response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
      try {
        const responseText = await response.text();
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || 'Failed to log consent');
        } catch (jsonParseError) {
          throw new Error(responseText || 'Failed to log consent');
        }
      } catch (readError) {
        throw new Error('Failed to log consent');
      }
    }

    try {
      return await response.json();
    } catch (parseError) {
      console.error('Failed to parse logConsent response:', parseError);
      throw new Error('Server returned invalid response. Please try again.');
    }
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

    try {
      return await response.json();
    } catch (parseError) {
      console.error('Failed to parse verifyUserConsent response:', parseError);
      return null;
    }
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

    try {
      return await response.json();
    } catch (parseError) {
      console.error('Failed to parse verifyConsentByToken response:', parseError);
      return null;
    }
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
      try {
        const responseText = await response.text();
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || 'Logout request failed');
        } catch (jsonParseError) {
          throw new Error(responseText || 'Logout request failed');
        }
      } catch (readError) {
        throw new Error('Logout request failed');
      }
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('Failed to parse logout response:', parseError);
      result = {
        success: true,
        message: 'Logout successful (response parse failed)',
        details: {
          tokensRevoked: 0,
          documentsCleared: true,
          sessionCleared: true
        }
      };
    }
    
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

    try {
      return await response.json();
    } catch (parseError) {
      console.error('Failed to parse getConsentStats response:', parseError);
      return null;
    }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || 'Failed to fetch subscription data');
      } catch (jsonParseError) {
        throw new Error(responseText || 'Failed to fetch subscription data');
      }
    } catch (readError) {
      throw new Error('Failed to fetch subscription data');
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getUserSubscription response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse createCustomerPortalSession response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `HTTP error! status: ${response.status}`);
      }
    } catch (readError) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse reactivateSubscription response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (jsonParseError) {
        if (responseText) {
          errorMessage = responseText;
        }
      }
    } catch (readError) {
      // If we can't read the response, use the status text
    }
    throw new Error(errorMessage);
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse submitPiiDetectionFeedback response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `Failed to fetch feedback summary: ${response.statusText}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `Failed to fetch feedback summary: ${response.statusText}`);
      }
    } catch (readError) {
      throw new Error(`Failed to fetch feedback summary: ${response.statusText}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getFeedbackSummary response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `Failed to fetch feedback analytics: ${response.statusText}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `Failed to fetch feedback analytics: ${response.statusText}`);
      }
    } catch (readError) {
      throw new Error(`Failed to fetch feedback analytics: ${response.statusText}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getFeedbackAnalytics response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `Failed to fetch improvement suggestions: ${response.statusText}`);
      } catch (jsonParseError) {
        throw new Error(responseText || `Failed to fetch improvement suggestions: ${response.statusText}`);
      }
    } catch (readError) {
      throw new Error(`Failed to fetch improvement suggestions: ${response.statusText}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse getImprovementSuggestions response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
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
    try {
      const responseText = await response.text();
      console.error('Admin API request failed:', response.status, responseText);
      throw new Error(`Admin API request failed: ${response.status} ${responseText}`);
    } catch (readError) {
      console.error('Admin API request failed:', response.status, response.statusText);
      throw new Error(`Admin API request failed: ${response.status} ${response.statusText}`);
    }
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error('Failed to parse adminApiRequest response:', parseError);
    throw new Error('Server returned invalid response. Please try again.');
  }
}