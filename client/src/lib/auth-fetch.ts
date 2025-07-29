/**
 * Enhanced fetch utility that includes JWT authentication
 * Falls back to JWT tokens when cookies don't work (e.g., in Replit staging)
 */

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Get JWT token from localStorage
  const accessToken = localStorage.getItem('jwt_access_token');
  
  // Prepare headers
  const headers = new Headers(options.headers || {});
  
  // Add Authorization header if token exists
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  // Add session ID header if exists
  const sessionId = sessionStorage.getItem('app-session-id');
  if (sessionId) {
    headers.set('x-session-id', sessionId);
  }
  
  // Merge options with auth headers
  const authOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include' as RequestCredentials, // Still include cookies if they work
  };
  
  // Make the request
  const response = await fetch(url, authOptions);
  
  // If unauthorized and we have a refresh token, try to refresh
  if (response.status === 401 && localStorage.getItem('jwt_refresh_token')) {
    console.log('Access token expired, attempting refresh...');
    
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
      const { tokens } = await refreshResponse.json();
      localStorage.setItem('jwt_access_token', tokens.access);
      localStorage.setItem('jwt_refresh_token', tokens.refresh);
      
      // Retry original request with new token
      headers.set('Authorization', `Bearer ${tokens.access}`);
      return fetch(url, authOptions);
    }
  }
  
  return response;
}

// Convenience method for session checks
export async function checkSession(): Promise<{ authenticated: boolean; user?: any }> {
  try {
    const response = await authFetch('/api/auth/session');
    if (response.ok) {
      return await response.json();
    }
    return { authenticated: false };
  } catch (error) {
    console.error('Session check failed:', error);
    return { authenticated: false };
  }
}