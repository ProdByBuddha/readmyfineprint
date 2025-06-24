import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { securityLogger, getClientInfo } from './security-logger';
import { databaseStorage } from './storage';
import { consentLogger } from './consent';

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
  
  console.log(`🔍 Admin auth attempt for ${req.path}`);
  console.log(`🔍 Headers:`, Object.keys(req.headers));
  console.log(`🔍 x-admin-key present:`, !!req.headers['x-admin-key']);

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
  const adminToken = req.headers['x-admin-token'] as string;

  // Support both admin key and admin token authentication
  if (providedKey) {
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
    req.user = {
      id: 'admin',
      email: 'admin@readmyfineprint.com',
      username: 'admin'
    };
    return next();
  }

  // Check admin token (from email verification)
  if (adminToken) {
    securityLogger.logAdminAuth(ip, userAgent, req.path + ' (via email verification)');
    req.user = {
      id: 'admin',
      email: 'admin@readmyfineprint.com',
      username: 'admin'
    };
    return next();
  }

  securityLogger.logFailedAuth(ip, userAgent, 'Missing admin authentication', req.path);
  return res.status(401).json({
    error: 'Admin authentication required.'
  });
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
 * Require admin authentication via subscription token
 * Checks if user has a valid subscription token and is an admin
 */
export async function requireAdminViaSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { ip, userAgent } = getClientInfo(req);
    const token = req.headers['x-subscription-token'] as string;
    
    if (!token) {
      securityLogger.logFailedAuth(ip, userAgent, 'Missing subscription token for admin access', req.path);
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    // Validate subscription token using hybrid service
    const { hybridTokenService } = await import("./hybrid-token-service");
    const tokenData = await hybridTokenService.validateSubscriptionToken(token);
    
    if (!tokenData) {
      securityLogger.logFailedAuth(ip, userAgent, 'Invalid subscription token for admin access', req.path);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user details
    const user = await databaseStorage.getUser(tokenData.userId);
    if (!user) {
      securityLogger.logFailedAuth(ip, userAgent, 'User not found for admin access', req.path);
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is admin
    const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
    if (!adminEmails.includes(user.email)) {
      securityLogger.logFailedAuth(ip, userAgent, `Non-admin user ${user.email} attempted admin access`, req.path);
      return res.status(403).json({ error: 'Admin access denied' });
    }

    // Log successful admin authentication
    securityLogger.logAdminAuth(ip, userAgent, req.path + ' (via subscription token)');
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username || undefined
    };
    
    next();
  } catch (error) {
    const { ip, userAgent } = getClientInfo(req);
    console.error('Admin auth error:', error);
    securityLogger.logFailedAuth(ip, userAgent, 'Admin authentication error', req.path);
    return res.status(500).json({ error: 'Authentication failed' });
  }
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

/**
 * Require user consent middleware
 * Verifies that the user has provided consent before accessing protected endpoints
 * Admins are exempt from consent requirements
 */
export async function requireConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const { ip, userAgent } = getClientInfo(req);
    
    // Check if this is an admin request (admin endpoints are exempt from consent)
    const adminKey = process.env.ADMIN_API_KEY;
    const providedKey = req.headers['x-admin-key'] as string;
    const adminToken = req.headers['x-admin-token'] as string;
    
    // Skip consent check for admin users
    if (adminKey && (providedKey === adminKey || adminToken)) {
      return next();
    }
    
    // Check for valid consent
    const consentProof = await consentLogger.verifyUserConsent(ip, userAgent);
    
    if (!consentProof) {
      securityLogger.logSecurityEvent(
        ip, 
        userAgent, 
        'CONSENT_REQUIRED', 
        'HIGH', 
        `Access denied - no valid consent found for ${req.path}`,
        req.path
      );
      
      return res.status(403).json({
        error: 'Consent required',
        message: 'You must accept our terms and conditions to access this service',
        code: 'CONSENT_REQUIRED',
        requiresConsent: true
      });
    }
    
    // Attach consent proof to request for potential use in handlers
    (req as any).consentProof = consentProof;
    next();
    
  } catch (error) {
    console.error('Error checking consent:', error);
    // In case of error, require consent to be safe
    return res.status(500).json({
      error: 'Unable to verify consent',
      message: 'Please try again or contact support',
      code: 'CONSENT_VERIFICATION_ERROR'
    });
  }
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