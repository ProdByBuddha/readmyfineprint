import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { securityLogger, getClientInfo } from './security-logger';

// Simple admin authentication middleware
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);
  const adminKey = process.env.ADMIN_API_KEY;

  // Enforce admin key requirement in ALL environments for security
  if (!adminKey) {
    const errorMessage = 'ADMIN_API_KEY environment variable is required for admin endpoints';
    console.error(`🔒 ${errorMessage}`);
    securityLogger.logSecurityError(ip, userAgent, 'Admin access denied - ADMIN_API_KEY not configured', req.path);
    return res.status(500).json({
      error: 'Admin endpoints are not properly configured. Contact system administrator.',
      code: 'ADMIN_KEY_NOT_CONFIGURED'
    });
  }

  const providedKey = req.headers['x-admin-key'] as string;

  if (!providedKey) {
    securityLogger.logFailedAuth(ip, userAgent, 'Missing admin key header', req.path);
    return res.status(401).json({
      error: 'Admin authentication required. Provide X-Admin-Key header.'
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  const providedBuffer = Buffer.from(providedKey);
  const adminBuffer = Buffer.from(adminKey);

  if (providedBuffer.length !== adminBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, adminBuffer)) {
    securityLogger.logFailedAuth(ip, userAgent, 'Invalid admin key provided', req.path);
    return res.status(403).json({
      error: 'Invalid admin key.'
    });
  }

  // Log successful admin authentication
  securityLogger.logAdminAuth(ip, userAgent, req.path);
  next();
}

// Middleware to add security headers
export function addSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.openai.com;"
  );

  next();
}
