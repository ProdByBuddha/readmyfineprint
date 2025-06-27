import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { securityLogger, getClientInfo } from './security-logger';

interface CSRFOptions {
  secretLength?: number;
  tokenLength?: number;
  cookieName?: string;
  headerName?: string;
  ignoreMethods?: string[];
  skipRoutes?: string[];
}

class CSRFProtection {
  private secretLength: number;
  private tokenLength: number;
  private cookieName: string;
  private headerName: string;
  private ignoreMethods: Set<string>;
  private skipRoutes: Set<string>;
  private tokenStore: Map<string, { secret: string; timestamp: number }>;
  private readonly TOKEN_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours
  private readonly CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

  constructor(options: CSRFOptions = {}) {
    this.secretLength = options.secretLength || 32;
    this.tokenLength = options.tokenLength || 32;
    this.cookieName = options.cookieName || 'csrf-token';
    this.headerName = options.headerName || 'x-csrf-token';
    this.ignoreMethods = new Set(options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS']);
    this.skipRoutes = new Set(options.skipRoutes || ['/api/stripe-webhook', '/health']);
    this.tokenStore = new Map();

    // Check if we're in development mode
    if (process.env.NODE_ENV === 'development' || process.env.USE_DB_FALLBACK === 'true') {
      console.log('⚠️ CSRF Protection initialized in development mode (verification will be bypassed)');
    } else {
      console.log('🔒 CSRF Protection enabled');
    }

    // Start cleanup interval
    setInterval(() => this.cleanupExpiredTokens(), this.CLEANUP_INTERVAL);
  }

  /**
   * Generate a cryptographically secure CSRF token
   */
  private generateSecret(): string {
    return crypto.randomBytes(this.secretLength).toString('base64url');
  }

  /**
   * Generate a CSRF token from a secret and session identifier
   */
  private generateToken(secret: string, sessionId: string): string {
    const payload = `${secret}:${sessionId}`;
    const hash = crypto.createHash('sha256').update(payload).digest('base64url');
    return hash.substring(0, this.tokenLength);
  }

  /**
   * Verify a CSRF token against the stored secret
   */
  private verifyTokenInternal(token: string, sessionId: string): boolean {
    const storedData = this.tokenStore.get(sessionId);
    if (!storedData) {
      return false;
    }

    // Check if token is expired
    if (Date.now() - storedData.timestamp > this.TOKEN_EXPIRY) {
      this.tokenStore.delete(sessionId);
      return false;
    }

    const expectedToken = this.generateToken(storedData.secret, sessionId);
    return crypto.timingSafeEqual(
      Buffer.from(token, 'base64url'),
      Buffer.from(expectedToken, 'base64url')
    );
  }

  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, data] of this.tokenStore.entries()) {
      if (now - data.timestamp > this.TOKEN_EXPIRY) {
        this.tokenStore.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 CSRF: Cleaned up ${cleanedCount} expired tokens`);
    }
  }

  /**
   * Get or create CSRF token for a session
   */
  getToken(sessionId: string): string {
    let storedData = this.tokenStore.get(sessionId);
    
    // Create new token if doesn't exist or is expired
    if (!storedData || (Date.now() - storedData.timestamp > this.TOKEN_EXPIRY)) {
      const secret = this.generateSecret();
      storedData = { secret, timestamp: Date.now() };
      this.tokenStore.set(sessionId, storedData);
    }

    return this.generateToken(storedData.secret, sessionId);
  }

  /**
   * Middleware to provide CSRF token to client
   */
  tokenProvider = (req: any, res: Response, next: NextFunction) => {
    // In development mode, provide a dummy token
    if (process.env.NODE_ENV === 'development' || process.env.USE_DB_FALLBACK === 'true') {
      const dummyToken = 'dev-csrf-token';
      res.setHeader('X-CSRF-Token', dummyToken);
      
      if (req.path === '/api/csrf-token' && req.method === 'GET') {
        return res.json({ csrfToken: dummyToken });
      }
      
      return next();
    }
    
    // Skip if no session ID (shouldn't happen with our setup)
    if (!req.sessionId) {
      return next();
    }

    // Generate or retrieve CSRF token
    const token = this.getToken(req.sessionId);
    
    // Set token in response header for client to read
    res.setHeader('X-CSRF-Token', token);
    
    // Also provide an endpoint to get the token via API
    if (req.path === '/api/csrf-token' && req.method === 'GET') {
      return res.json({ csrfToken: token });
    }

    next();
  };

  /**
   * Middleware to verify CSRF token on state-changing requests
   */
  verifyToken = (req: any, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    const path = req.path;

    // Skip CSRF verification in development mode
    if (process.env.NODE_ENV === 'development' || process.env.USE_DB_FALLBACK === 'true') {
      console.log(`⚠️ Development mode: Bypassing CSRF verification for ${method} ${path}`);
      return next();
    }

    // Skip verification for safe methods
    if (this.ignoreMethods.has(method)) {
      return next();
    }

    // Skip verification for whitelisted routes
    if (this.skipRoutes.has(path) || Array.from(this.skipRoutes).some(route => path.startsWith(route))) {
      return next();
    }

    // Skip verification if no session ID (shouldn't happen)
    if (!req.sessionId) {
      return next();
    }

    // Get token from header or body
    const token = req.get(this.headerName) || req.body?.csrfToken;

    if (!token) {
      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "CSRF_TOKEN_MISSING" as any,
        severity: "HIGH" as any,
        message: `CSRF token missing for ${method} ${path}`,
        ip,
        userAgent,
        endpoint: path,
        details: { method, sessionId: req.sessionId }
      });

      return res.status(403).json({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING'
      });
    }

    // Verify the token
    if (!this.verifyTokenInternal(token, req.sessionId)) {
      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "CSRF_TOKEN_INVALID" as any,
        severity: "HIGH" as any,
        message: `Invalid CSRF token for ${method} ${path}`,
        ip,
        userAgent,
        endpoint: path,
        details: { method, sessionId: req.sessionId, tokenProvided: !!token }
      });

      return res.status(403).json({
        error: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID'
      });
    }

    // Token is valid, proceed
    next();
  };

  /**
   * Get current statistics
   */
  getStats() {
    const now = Date.now();
    let activeTokens = 0;
    let expiredTokens = 0;

    for (const data of this.tokenStore.values()) {
      if (now - data.timestamp > this.TOKEN_EXPIRY) {
        expiredTokens++;
      } else {
        activeTokens++;
      }
    }

    return {
      totalTokens: this.tokenStore.size,
      activeTokens,
      expiredTokens,
      tokenExpiry: this.TOKEN_EXPIRY,
      lastCleanup: now
    };
  }
}

// Create singleton instance
export const csrfProtection = new CSRFProtection({
  skipRoutes: [
    '/api/stripe-webhook',
    '/health',
    '/api/csrf-token' // Allow getting CSRF token without verification
  ]
});

// Export the middleware functions
export const provideCsrfToken = csrfProtection.tokenProvider;
export const verifyCsrfToken = csrfProtection.verifyToken;

// Export the service for direct use
export { CSRFProtection };