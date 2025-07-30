/**
 * CSRF Protection Manager
 * Handles CSRF token management for secure requests
 */

class CSRFManager {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private readonly TOKEN_VALIDITY = 2.5 * 60 * 60 * 1000; // 2.5 hours (slightly less than server expiry)
  private fetchPromise: Promise<string> | null = null;

  /**
   * Get or fetch CSRF token
   */
  async getToken(sessionId: string): Promise<string> {
    // Return cached token if still valid
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    // If there's already a fetch in progress, wait for it
    if (this.fetchPromise) {
      try {
        return await this.fetchPromise;
      } catch (error) {
        // If the promise failed, clear it and try again
        this.fetchPromise = null;
        throw error;
      }
    }

    // Start a new fetch
    this.fetchPromise = this.fetchTokenFromServer(sessionId);
    
    try {
      const token = await this.fetchPromise;
      this.fetchPromise = null;
      return token;
    } catch (error) {
      this.fetchPromise = null;
      throw error;
    }
  }

  /**
   * Fetch fresh CSRF token from server
   */
  private async fetchTokenFromServer(sessionId: string): Promise<string> {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.csrfToken) {
        throw new Error('No CSRF token received from server');
      }

      // Cache the token
      this.token = data.csrfToken;
      this.tokenExpiry = Date.now() + this.TOKEN_VALIDITY;
      
      return data.csrfToken;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching CSRF token:', error);
      }
      throw error;
    }
  }

  /**
   * Add CSRF token to request headers
   */
  async addTokenToHeaders(sessionId: string, headers: Record<string, string> = {}): Promise<Record<string, string>> {
    try {
      const token = await this.getToken(sessionId);
      
      return {
        ...headers,
        'x-csrf-token': token,
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to add CSRF token to headers:', error);
      }
      // Return headers without CSRF token rather than failing the request
      return headers;
    }
  }

  /**
   * Make a fetch request with CSRF protection
   */
  async fetch(url: string, options: RequestInit = {}, sessionId: string): Promise<Response> {
    const method = (options.method || 'GET').toUpperCase();
    
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return fetch(url, {
        ...options,
        credentials: 'include',
      });
    }

    try {
      // Add CSRF token to headers
      const headers = await this.addTokenToHeaders(sessionId, options.headers as Record<string, string> || {});
      
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      // If we get a 403 with CSRF error, clear token and retry once
      if (response.status === 403) {
        const errorText = await response.text();
        if (errorText.includes('CSRF') || errorText.includes('csrf')) {
          if (import.meta.env.DEV) {
            console.log('CSRF token invalid, clearing and retrying...');
          }
          this.clearToken();
          
          // Retry once with fresh token
          const retryHeaders = await this.addTokenToHeaders(sessionId, options.headers as Record<string, string> || {});
          return fetch(url, {
            ...options,
            headers: retryHeaders,
            credentials: 'include',
          });
        }
      }

      return response;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('CSRF fetch error:', error);
      }
      throw error;
    }
  }

  /**
   * Clear cached token (for logout, token expiry, etc.)
   */
  clearToken(): void {
    this.token = null;
    this.tokenExpiry = 0;
    this.fetchPromise = null;
  }

  /**
   * Check if we have a valid cached token
   */
  hasValidToken(): boolean {
    return this.token !== null && Date.now() < this.tokenExpiry;
  }

  /**
   * Get current token without fetching (for debugging)
   */
  getCurrentToken(): string | null {
    return this.token;
  }
}

// Global CSRF manager instance
const csrfManager = new CSRFManager();

/**
 * Fetch wrapper with CSRF protection
 * This function requires a session ID to be passed in to avoid circular dependencies
 */
export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  // Get session ID from sessionStorage directly to avoid circular import
  const sessionId = sessionStorage.getItem('app-session-id') || 'anonymous';
  
  return csrfManager.fetch(url, options, sessionId);
}

/**
 * Clear CSRF token (for logout, etc.)
 */
export function clearCSRFToken(): void {
  csrfManager.clearToken();
}

/**
 * Check if CSRF manager has a valid token
 */
export function hasValidCSRFToken(): boolean {
  return csrfManager.hasValidToken();
}

export { csrfManager };