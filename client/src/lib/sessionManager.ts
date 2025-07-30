/**
 * Session Manager - Ensures all components use the same session
 * Prevents session fragmentation that causes consent state inconsistencies
 */

import { fetchWithCSRF } from './csrfManager';

// Session ID management - use sessionStorage for consistency
let globalSessionId: string | null = null;

function generateSessionId(): string {
  return crypto.getRandomValues(new Uint8Array(16))
    .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
}

export function getGlobalSessionId(): string {
  if (!globalSessionId) {
    globalSessionId = sessionStorage.getItem('app-session-id') || generateSessionId();
    sessionStorage.setItem('app-session-id', globalSessionId);
  }
  return globalSessionId;
}

export function updateSessionId(newSessionId: string): void {
  globalSessionId = newSessionId;
  sessionStorage.setItem('app-session-id', newSessionId);
}

export function generateNewSessionId(): string {
  const newId = generateSessionId();
  updateSessionId(newId);
  return newId;
}

/**
 * Session-aware fetch that automatically includes session ID
 * For state-changing operations, this will also handle CSRF tokens
 */
export async function sessionFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const sessionId = getGlobalSessionId();
  
  // For state-changing methods, use CSRF protection
  const method = (options.method || 'GET').toUpperCase();
  const needsCSRF = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  
  if (needsCSRF) {
    // Use fetchWithCSRF with session ID and JWT token
    const headers = {
      ...options.headers as Record<string, string> || {},
      'x-session-id': sessionId,
    };
    
    // Add JWT authorization header if token exists
    const accessToken = localStorage.getItem('jwt_access_token');
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log('🔑 sessionFetch (CSRF): Adding JWT token to request:', {
        url,
        hasToken: !!accessToken,
        tokenPrefix: accessToken.substring(0, 20) + '...'
      });
    } else {
      console.log('⚠️ sessionFetch (CSRF): No JWT token found in localStorage for:', url);
    }
    
    return fetchWithCSRF(url, {
      ...options,
      headers,
    });
  }
  
  // For GET requests, add session ID and JWT token if available
  const headers = {
    ...options.headers as Record<string, string> || {},
    'x-session-id': sessionId,
  };
  
  // Add JWT authorization header if token exists
  const accessToken = localStorage.getItem('jwt_access_token');
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
    console.log('🔑 sessionFetch: Adding JWT token to request:', {
      url,
      hasToken: !!accessToken,
      tokenPrefix: accessToken.substring(0, 20) + '...'
    });
  } else {
    console.log('⚠️ sessionFetch: No JWT token found in localStorage for:', url);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  // Debug logging for authentication issues
  if (response.status === 401) {
    console.log('❌ sessionFetch: 401 Unauthorized response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      sentHeaders: headers
    });
  }
  
  // Update session ID if server provides one
  const serverSessionId = response.headers.get('x-session-id');
  if (serverSessionId && serverSessionId !== sessionId) {
    updateSessionId(serverSessionId);
  }
  
  return response;
}

export function clearSession(): void {
  globalSessionId = null;
  sessionStorage.removeItem('app-session-id');
  
  // Generate new session ID immediately
  generateNewSessionId();
}