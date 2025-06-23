import { apiRequest } from "./queryClient";
import type { Document } from "@shared/schema";

// Interface for consent verification proof
interface ConsentProof {
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  [key: string]: unknown;
}

// Session ID management for non-apiRequest calls
function getSessionId(): string {
  // This should match the session ID from queryClient
  // For now, let's get it from a global or generate consistently
  let sessionId = sessionStorage.getItem('app-session-id');
  if (!sessionId) {
    sessionId = crypto.getRandomValues(new Uint8Array(16))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    sessionStorage.setItem('app-session-id', sessionId);
  }
  return sessionId;
}

export async function createDocument(data: { title: string; content: string }): Promise<Document> {
  const response = await apiRequest("POST", "/api/documents", data);
  return response.json();
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: {
      'x-session-id': getSessionId(),
    },
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export async function analyzeDocument(id: number): Promise<Document> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Include subscription token if available
  const subscriptionToken = localStorage.getItem('subscriptionToken');
  if (subscriptionToken) {
    headers['x-subscription-token'] = subscriptionToken;
  }

  // Include device fingerprint if available
  const deviceFingerprint = localStorage.getItem('deviceFingerprint');
  if (deviceFingerprint) {
    headers['x-device-fingerprint'] = deviceFingerprint;
  }

  const response = await fetch(`/api/documents/${id}/analyze`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to analyze document');
  }

  return response.json();
}

// Poll for document analysis completion
async function pollForDocumentAnalysis(documentId: number, queueInfo: any): Promise<Document> {
  const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
  let attempts = 0;

  console.log(`[Priority Queue] Document ${documentId} queued. Estimated wait: ${queueInfo.estimatedWaitTime}s`);

  while (attempts < maxAttempts) {
    // Wait before checking status
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
    attempts++;

    try {
      // Check if document analysis is complete
      const document = await getDocument(documentId);

      if (document.analysis) {
        console.log(`[Priority Queue] Document ${documentId} analysis completed after ${attempts * 5} seconds`);
        return document;
      }

      // Get queue status for user feedback
      const queueStatus = await getQueueStatus();
      console.log(`[Priority Queue] Still waiting... Queue length: ${queueStatus.queueLength}, Processing: ${queueStatus.currentlyProcessing}`);

    } catch (error) {
      console.error(`[Priority Queue] Error polling for document ${documentId}:`, error);
    }
  }

  throw new Error("Document analysis timed out. Please try again or contact support if the issue persists.");
}

// Get processing queue status
export async function getQueueStatus(): Promise<{
  queueLength: number;
  currentlyProcessing: number;
  concurrentLimit: number;
  queueByTier: Record<string, number>;
  userHasRequestInQueue: boolean;
  timestamp: number;
}> {
  const response = await apiRequest("GET", "/api/queue/status");
  return response.json();
}

export async function getDocument(documentId: number): Promise<Document> {
  const response = await fetch(`/api/documents/${documentId}`, {
    headers: {
      'x-session-id': getSessionId(),
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
      'x-session-id': getSessionId(),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }

  return response.json();
}

export async function clearAllDocuments(): Promise<{ message: string }> {
  const response = await fetch('/api/documents', {
    method: 'DELETE',
    headers: {
      'x-session-id': getSessionId(),
    },
    credentials: 'include',
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
    const response = await fetch('/api/consent', {
      method: 'POST',
      credentials: 'include',
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
    const response = await fetch('/api/consent/verify', {
      method: 'POST',
      credentials: 'include',
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
    const response = await fetch('/api/consent/verify-token', {
      method: 'POST',
      credentials: 'include',
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

  // Include subscription token if available
  const subscriptionToken = localStorage.getItem('subscriptionToken');
  if (subscriptionToken) {
    headers['x-subscription-token'] = subscriptionToken;
  }

  // Include device fingerprint if available
  const deviceFingerprint = localStorage.getItem('deviceFingerprint');
  if (deviceFingerprint) {
    headers['x-device-fingerprint'] = deviceFingerprint;
  }

  const response = await fetch('/api/user/subscription', {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription data');
  }

  // Store any token updates from server
  const newToken = response.headers.get('X-Subscription-Token');
  if (newToken) {
    localStorage.setItem('subscriptionToken', newToken);
  }

  // Check if token was invalidated
  const tokenInvalid = response.headers.get('X-Subscription-Token-Invalid');
  if (tokenInvalid) {
    localStorage.removeItem('subscriptionToken');
  }

  return response.json();
}