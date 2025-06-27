/**
 * CSRF Token Manager for Frontend
 * Handles fetching, storing, and including CSRF tokens in requests
 */

class CSRFManager {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private readonly TOKEN_VALIDITY = 2.5 * 60 * 60 * 1000; // 2.5 hours (slightly less than server expiry)
  private fetchPromise: Promise<string> | null = null;

  /**
   * Get CSRF token from cache or fetch from server
   */
  async getToken(): Promise<string> {
    // In development mode, return a dummy token
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      console.log('⚠️ Development mode: Using dummy CSRF token');
      return 'dev-csrf-token';
    }
    
    // Return cached token if still valid
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    // If there's already a fetch in progress, wait for it
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Start new fetch
    this.fetchPromise = this.fetchTokenFromServer();
    
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
   * Fetch CSRF token from server
   */
  private async fetchTokenFromServer(): Promise<string> {
    try {
      const sessionId = await this.getSessionId();
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include', // Include cookies for session
        headers: {
          'x-session-id': sessionId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.csrfToken) {
        throw new Error('No CSRF token received from server');
      }

      // Cache the token
      this.token = data.csrfToken as string;
      this.tokenExpiry = Date.now() + this.TOKEN_VALIDITY;

      console.log('🔒 CSRF token refreshed');
      return this.token;
    } catch (error) {
      console.error('❌ Failed to fetch CSRF token:', error);
      throw error;
    }
  }

  /**
   * Get session ID from sessionManager to ensure consistency
   */
  private async getSessionId(): Promise<string> {
    // Import getGlobalSessionId dynamically to avoid circular imports
    const { getGlobalSessionId } = await import('./sessionManager');
    return getGlobalSessionId();
  }

  /**
   * Add CSRF token to request headers
   */
  async addTokenToHeaders(headers: Record<string, string> = {}): Promise<Record<string, string>> {
    try {
      const token = await this.getToken();
      const sessionId = await this.getSessionId();
      return {
        ...headers,
        'x-csrf-token': token,
        'x-session-id': sessionId,
      };
    } catch (error) {
      console.warn('⚠️ Failed to add CSRF token to headers:', error);
      
      // In development mode, continue with dummy token
      if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
        const sessionId = await this.getSessionId();
        return {
          ...headers,
          'x-csrf-token': 'dev-csrf-token',
          'x-session-id': sessionId,
        };
      }
      
      // Return headers without CSRF token - server will reject the request
      const sessionId = await this.getSessionId();
      return {
        ...headers,
        'x-session-id': sessionId,
      };
    }
  }

  /**
   * Make a fetch request with CSRF protection
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Only add CSRF token for state-changing methods
    const method = (options.method || 'GET').toUpperCase();
    const needsCSRF = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (needsCSRF) {
      const headers = await this.addTokenToHeaders(options.headers as Record<string, string> || {});
      options.headers = headers;
    } else {
      // For safe methods, still add session ID
      const sessionId = await this.getSessionId();
      const headers = {
        ...options.headers as Record<string, string> || {},
        'x-session-id': sessionId,
      };
      options.headers = headers;
    }

    // Include credentials for session management
    options.credentials = options.credentials || 'include';

    const response = await fetch(url, options);

    // If we get a CSRF error, try to refresh token and retry once
    if (response.status === 403 && needsCSRF) {
      try {
        const errorData = await response.clone().json();
        if (errorData.code === 'CSRF_TOKEN_INVALID' || errorData.code === 'CSRF_TOKEN_MISSING') {
          console.log('🔄 CSRF token invalid, refreshing and retrying...');
          
          // Clear cached token and refetch
          this.token = null;
          this.tokenExpiry = 0;
          
          const newHeaders = await this.addTokenToHeaders(options.headers as Record<string, string> || {});
          options.headers = newHeaders;
          
          // Retry the request
          return fetch(url, options);
        }
      } catch (parseError) {
        // If we can't parse the error, just return the original response
      }
    }

    return response;
  }

  /**
   * Clear cached token (useful for logout)
   */
  clearToken(): void {
    this.token = null;
    this.tokenExpiry = 0;
    this.fetchPromise = null;
  }

  /**
   * Check if token is cached and valid
   */
  hasValidToken(): boolean {
    return this.token !== null && Date.now() < this.tokenExpiry;
  }

  /**
   * Get current token without fetching (returns null if not cached)
   */
  getCurrentToken(): string | null {
    if (this.hasValidToken()) {
      return this.token;
    }
    return null;
  }
}

// Create singleton instance
export const csrfManager = new CSRFManager();

// Export convenience functions
export const fetchWithCSRF = csrfManager.fetch.bind(csrfManager);
export const getCSRFToken = csrfManager.getToken.bind(csrfManager);
export const clearCSRFToken = csrfManager.clearToken.bind(csrfManager);