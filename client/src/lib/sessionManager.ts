/**
 * Session Manager - Ensures all components use the same session
 * Prevents session fragmentation that causes consent state inconsistencies
 */

let globalSessionId: string | null = null;

/**
 * Generate a consistent session identifier
 */
function generateSessionId(): string {
  return 'session_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
}

/**
 * Get or create a global session ID that all components will use
 */
export function getGlobalSessionId(): string {
  if (!globalSessionId) {
    // Try to get from sessionStorage first
    const stored = sessionStorage.getItem('rmfp_session_id');
    if (stored) {
      globalSessionId = stored;
    } else {
      globalSessionId = generateSessionId();
      sessionStorage.setItem('rmfp_session_id', globalSessionId);
    }
  }
  return globalSessionId;
}

/**
 * Create fetch wrapper that ensures session consistency
 */
export async function sessionFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const sessionId = getGlobalSessionId();
  
  // Merge session ID into headers
  const headers = new Headers(options.headers || {});
  headers.set('X-Session-ID', sessionId);
  
  const finalOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Always include credentials for session cookies
  };

  console.log(`Making request to ${url} with session: ${sessionId.substring(0, 16)}...`);
  
  return fetch(url, finalOptions);
}

/**
 * Clear session data (for logout, etc.)
 */
export function clearSession(): void {
  globalSessionId = null;
  sessionStorage.removeItem('rmfp_session_id');
}