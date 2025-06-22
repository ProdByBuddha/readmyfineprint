import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { securityLogger, getClientInfo } from './security-logger';
import { databaseStorage } from './storage';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username?: string;
      };
      sessionId?: string;
    }
  }
}

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

/**
 * Optional user authentication middleware
 * Attempts to identify the user but doesn't require authentication
 */
export async function optionalUserAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { ip, userAgent } = getClientInfo(req);

    // Try to get user from JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      if (process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
          const user = await databaseStorage.getUser(decoded.userId);

          if (user) {
            req.user = {
              id: user.id,
              email: user.email,
              username: user.username || undefined,
            };
            console.log(`🔑 User authenticated via JWT: ${user.email} (${user.id})`);
          }
        } catch (jwtError) {
          console.log('Invalid JWT token:', jwtError instanceof Error ? jwtError.message : 'Unknown error');
        }
      }
    }

    // If no user found, try session-based authentication (for backwards compatibility)
    if (!req.user) {
      // Check for user ID in session or headers (temporary fallback)
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        const user = await databaseStorage.getUser(userId);
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            username: user.username || undefined,
          };
          console.log(`🔑 User authenticated via header: ${user.email} (${user.id})`);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Error in user authentication middleware:', error);
    // Don't fail the request, just continue without user
    next();
  }
}

/**
 * Require user authentication middleware
 * Requires the user to be authenticated
 */
export async function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  await optionalUserAuth(req, res, () => {
    if (!req.user) {
      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logFailedAuth(ip, userAgent, 'Authentication required', req.path);
      return res.status(401).json({
        error: 'Authentication required. Please log in to access this resource.'
      });
    }
    next();
  });
}

/**
 * Generate JWT token for user
 */
export function generateJWT(userId: string): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // 7 days
  );
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

  // HSTS (HTTP Strict Transport Security) - tells browsers/crawlers to only use HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content Security Policy with comprehensive Stripe, Shields.io, and Replit support
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://replit.com; " +
    "script-src-elem 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.com https://replit.com; " +
    "style-src 'self' 'unsafe-inline' https://js.stripe.com; " +
    "img-src 'self' data: https://img.shields.io https://js.stripe.com; " +
    "connect-src 'self' https://api.openai.com https://api.stripe.com https://js.stripe.com https://m.stripe.com; " +
    "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.com;"
  );

  next();
}
