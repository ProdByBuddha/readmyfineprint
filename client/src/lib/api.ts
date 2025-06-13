import { apiRequest } from "./queryClient";
import type { Document, InsertDocument } from "@shared/schema";

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

export async function analyzeDocument(documentId: number): Promise<Document> {
  const response = await apiRequest("POST", `/api/documents/${documentId}/analyze`);
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
