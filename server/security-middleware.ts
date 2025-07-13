/**
 * Enhanced Security Middleware
 * Provides additional protection against common vulnerabilities including esbuild CORS issues
 */

import { Request, Response, NextFunction } from 'express';
import { getClientInfo } from './security-logger';

interface SecurityOptions {
  developmentMode?: boolean;
  allowedOrigins?: string[];
  maxRequestSize?: number;
}

export class SecurityMiddleware {
  private options: SecurityOptions;
  private suspiciousPatterns: RegExp[];
  private blockedUserAgents: RegExp[];

  constructor(options: SecurityOptions = {}) {
    this.options = {
      developmentMode: process.env.NODE_ENV === 'development',
      allowedOrigins: options.allowedOrigins || [],
      maxRequestSize: options.maxRequestSize || 50 * 1024 * 1024, // 50MB
      ...options
    };

    // Patterns that might indicate esbuild development server exploitation
    this.suspiciousPatterns = [
      /\/\.\./,  // Directory traversal
      /esbuild/i, // Direct esbuild references
      /webpack/i, // Webpack dev server patterns
      /hot-update/i, // Hot module replacement patterns
      /sockjs/i, // Socket.js patterns used by dev servers
      /__webpack_hmr/i, // Webpack HMR patterns
    ];

    // Suspicious user agents that might indicate automated attacks
    this.blockedUserAgents = [
      /curl/i,
      /wget/i,
      /python-requests/i,
      /node-fetch/i,
      /axios/i,
    ];
  }

  /**
   * Enhanced CORS protection specifically for esbuild vulnerability mitigation
   */
  enhancedCorsProtection = (req: Request, res: Response, next: NextFunction) => {
    const { ip, userAgent } = getClientInfo(req);
    const origin = req.get('origin');
    const referer = req.get('referer');

    // In production, be very strict about origins
    if (!this.options.developmentMode) {
      // Block requests with suspicious patterns in URL
      if (this.suspiciousPatterns.some(pattern => pattern.test(req.url))) {
        console.warn(`🚨 Blocked suspicious request pattern: ${req.url} from ${ip}`);
        return res.status(403).json({ error: 'Forbidden request pattern' });
      }

      // Block suspicious user agents in production
      if (this.blockedUserAgents.some(pattern => pattern.test(userAgent))) {
        console.warn(`🚨 Blocked suspicious user agent: ${userAgent} from ${ip}`);
        return res.status(403).json({ error: 'Forbidden user agent' });
      }

      // Strict origin validation
      if (origin && !this.isAllowedOrigin(origin)) {
        console.warn(`🚨 Blocked disallowed origin: ${origin} from ${ip}`);
        return res.status(403).json({ error: 'Origin not allowed' });
      }
    }

    // Add additional security headers to prevent esbuild exploitation
    res.setHeader('X-Development-Server', 'false');
    res.setHeader('X-Esbuild-Protection', 'enabled');
    
    // Prevent embedding in iframes from untrusted origins
    if (origin && !this.isAllowedOrigin(origin)) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    next();
  };

  /**
   * Request size and rate limiting for development server protection
   */
  requestSizeProtection = (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > this.options.maxRequestSize!) {
      const { ip } = getClientInfo(req);
      console.warn(`🚨 Blocked oversized request: ${contentLength} bytes from ${ip}`);
      return res.status(413).json({ error: 'Request too large' });
    }

    next();
  };

  /**
   * Development server specific protections
   */
  developmentServerProtection = (req: Request, res: Response, next: NextFunction) => {
    // Only apply in development mode
    if (!this.options.developmentMode) {
      return next();
    }

    const { ip, userAgent } = getClientInfo(req);

    // Block direct access to development server endpoints
    const devServerPatterns = [
      /\/__vite_ping/,
      /\/@vite\/client/,
      /\/@react-refresh/,
      /\/\.vite\//,
      /\/node_modules\//,
    ];

    if (devServerPatterns.some(pattern => pattern.test(req.url))) {
      // Only allow these from localhost or known development origins
      if (!this.isLocalhost(ip) && !this.isDevelopmentOrigin(req.get('origin'))) {
        console.warn(`🚨 Blocked dev server access from external IP: ${ip}`);
        return res.status(403).json({ error: 'Development resources not accessible externally' });
      }
    }

    next();
  };

  /**
   * Check if origin is in allowed list
   */
  private isAllowedOrigin(origin: string): boolean {
    if (!origin) return false;
    
    const allowedOrigins = this.options.allowedOrigins || [];
    
    // Check exact matches
    if (allowedOrigins.includes(origin)) return true;
    
    // Check pattern matches for development
    if (this.options.developmentMode) {
      const devPatterns = [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
        /^https?:\/\/.*\.replit\.dev$/,
        /^https?:\/\/.*\.repl\.co$/,
        /^https?:\/\/.*\.replit\.app$/,
      ];
      
      return devPatterns.some(pattern => pattern.test(origin));
    }
    
    return false;
  }

  /**
   * Check if IP is localhost
   */
  private isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  }

  /**
   * Check if origin is a development origin
   */
  private isDevelopmentOrigin(origin?: string): boolean {
    if (!origin) return false;
    
    const devPatterns = [
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/,
      /^https?:\/\/.*\.replit\.dev$/,
    ];
    
    return devPatterns.some(pattern => pattern.test(origin));
  }
}

// Create singleton instance
export const securityMiddleware = new SecurityMiddleware({
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:5000')
    .split(',')
    .map(origin => origin.trim()),
});

// Export middleware functions
export const enhancedCorsProtection = securityMiddleware.enhancedCorsProtection;
export const requestSizeProtection = securityMiddleware.requestSizeProtection;
export const developmentServerProtection = securityMiddleware.developmentServerProtection; 