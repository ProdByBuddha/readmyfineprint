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
    // Use fetchWithCSRF with session ID
    const headers = {
      ...options.headers as Record<string, string> || {},
      'x-session-id': sessionId,
    };
    
    return fetchWithCSRF(url, {
      ...options,
      headers,
    });
  }
  
  // For GET requests, just add session ID
  const headers = {
    ...options.headers as Record<string, string> || {},
    'x-session-id': sessionId,
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  
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