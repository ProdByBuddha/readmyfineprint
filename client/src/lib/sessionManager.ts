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
    const headers: Record<string, string> = {
      ...options.headers as Record<string, string> || {},
      'x-session-id': sessionId,
    };

    // Add JWT authorization header if token exists
    let accessToken = localStorage.getItem('jwt_access_token');

    // For mobile browsers, also try sessionStorage as fallback
    if (!accessToken) {
      accessToken = sessionStorage.getItem('jwt_access_token');
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      if (import.meta.env.DEV) {
        console.log('🔑 sessionFetch (CSRF): Adding JWT token to request:', {
          url,
          hasToken: !!accessToken,
          tokenPrefix: accessToken.substring(0, 20) + '...'
        });
      }
    } else {
      if (import.meta.env.DEV) {
        console.log('⚠️ sessionFetch (CSRF): No JWT token found in localStorage or sessionStorage for:', url);
      }
    }

    const response = await fetchWithCSRF(url, {
      ...options,
      headers,
    });

    // Handle token refresh for CSRF requests too
    if (response.status === 401 && accessToken && localStorage.getItem('jwt_refresh_token')) {
      if (import.meta.env.DEV) {
        console.log('❌ sessionFetch (CSRF): 401 Unauthorized - attempting token refresh...');
      }

      try {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: localStorage.getItem('jwt_refresh_token'),
          }),
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          const contentType = refreshResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const { tokens } = await refreshResponse.json();
            // Store in both localStorage and sessionStorage for mobile compatibility
            localStorage.setItem('jwt_access_token', tokens.access);
            localStorage.setItem('jwt_refresh_token', tokens.refresh);
            sessionStorage.setItem('jwt_access_token', tokens.access);
            sessionStorage.setItem('jwt_refresh_token', tokens.refresh);

            if (import.meta.env.DEV) {
              console.log('✅ Token refresh successful, retrying CSRF request...');
            }

            // Retry original CSRF request with new token
            const newHeaders = {
              ...headers,
              'Authorization': `Bearer ${tokens.access}`
            };

            return fetchWithCSRF(url, {
              ...options,
              headers: newHeaders,
            });
          }
        }
      } catch (refreshError) {
        console.log('Token refresh failed for CSRF request:', refreshError instanceof Error ? refreshError.message : 'Unknown error');
        localStorage.removeItem('jwt_access_token');
        localStorage.removeItem('jwt_refresh_token');
      }
    }

    return response;
  }

  // For GET requests, add session ID and JWT token if available
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string> || {},
    'x-session-id': sessionId,
  };

  // Add JWT authorization header if token exists
  const accessToken = localStorage.getItem('jwt_access_token');
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
    if (import.meta.env.DEV) {
      console.log('🔑 sessionFetch: Adding JWT token to request:', {
        url,
        hasToken: !!accessToken,
        tokenPrefix: accessToken.substring(0, 20) + '...'
      });
    }
  } else {
    if (import.meta.env.DEV) {
      console.log('⚠️ sessionFetch: No JWT token found in localStorage for:', url);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Debug logging and token refresh for authentication issues
  if (response.status === 401 && accessToken && localStorage.getItem('jwt_refresh_token')) {
    if (import.meta.env.DEV) {
      console.log('❌ sessionFetch: 401 Unauthorized - attempting token refresh...');
    }

    try {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: localStorage.getItem('jwt_refresh_token'),
        }),
        credentials: 'include',
      });

      if (refreshResponse.ok) {
        const contentType = refreshResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const { tokens } = await refreshResponse.json();
          localStorage.setItem('jwt_access_token', tokens.access);
          localStorage.setItem('jwt_refresh_token', tokens.refresh);

          if (import.meta.env.DEV) {
            console.log('✅ Token refresh successful, retrying original request...');
          }

          // Retry original request with new token
          const newHeaders = {
            ...headers,
            'Authorization': `Bearer ${tokens.access}`
          };

          return fetch(url, {
            ...options,
            headers: newHeaders,
            credentials: 'include',
          });
        } else {
          console.warn('Refresh endpoint returned non-JSON response');
        }
      } else {
        console.log('Token refresh failed with status:', refreshResponse.status);
      }
    } catch (refreshError) {
      console.log('Token refresh failed:', refreshError instanceof Error ? refreshError.message : 'Unknown error');
      // Clear invalid tokens to prevent repeated failed refresh attempts
      localStorage.removeItem('jwt_access_token');
      localStorage.removeItem('jwt_refresh_token');
    }
  } else if (response.status === 401) {
    if (import.meta.env.DEV) {
      console.log('❌ sessionFetch: 401 Unauthorized response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        sentHeaders: headers,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!localStorage.getItem('jwt_refresh_token')
      });
    }
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

  // Clear JWT tokens from both storages for mobile compatibility
  localStorage.removeItem('jwt_access_token');
  localStorage.removeItem('jwt_refresh_token');
  sessionStorage.removeItem('jwt_access_token');
  sessionStorage.removeItem('jwt_refresh_token');

  // Clear consent data that's tied to session
  sessionStorage.removeItem('readmyfineprint-consent-id');
  sessionStorage.removeItem('readmyfineprint-verification-token');

  // Clear all other session-specific data
  sessionStorage.clear();

  // Clear sensitive data from localStorage
  localStorage.removeItem('subscriptionToken');
  localStorage.removeItem('subscription_token');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');

  // Generate new session ID immediately
  generateNewSessionId();
}