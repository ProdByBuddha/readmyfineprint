import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { secureJWTService } from './secure-jwt-service';
import crypto from 'crypto';
import { securityLogger, getClientInfo, SecurityEventType, SecuritySeverity } from './security-logger';
import { databaseStorage } from './storage';
import { consentLogger } from './consent';
import { adminVerificationService } from './admin-verification';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      sessionId?: string;
    }
  }
}

// Simple admin authentication middleware
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);
  const adminKey = process.env.ADMIN_API_KEY;

  console.log(`🔍 Admin auth attempt for ${req.path}`);

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
  const authHeader = req.headers.authorization as string;

  // Development mode bypass - check for JWT token from auto-login
  if (process.env.NODE_ENV === 'development') {
    // Check for Bearer token from development auto-login
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwtToken = authHeader.substring(7);
      try {
        const { secureJWTService } = await import('./secure-jwt-service');
        const validation = await secureJWTService.validateAccessToken(jwtToken);
        if (validation.valid && validation.payload) {
          console.log('🔓 Development mode: Admin access granted with JWT token');
          securityLogger.logAdminAuth(ip, userAgent, req.path + ' (dev JWT)');
          req.user = {
            id: validation.payload.userId,
            email: validation.payload.email || 'admin@readmyfineprint.com'
          };
          return next();
        }
      } catch (jwtError) {
        console.log('Development JWT validation failed:', jwtError);
      }
    }

    // Fallback to API key bypass
    if (providedKey === adminKey) {
      console.log('🔓 Development mode: Admin access granted with API key only');
      securityLogger.logAdminAuth(ip, userAgent, req.path);
      req.user = {
        id: 'dev-admin',
        email: 'admin@readmyfineprint.com'
      };
      return next();
    }
  }

  // Require both admin key AND valid admin token for security
  if (!providedKey || !adminToken) {
    securityLogger.logFailedAuth(ip, userAgent, 'Missing admin credentials', req.path);
    return res.status(401).json({ 
      error: 'Admin authentication required. Both admin key and verification token are needed.',
      code: 'MISSING_ADMIN_CREDENTIALS'
    });
  }

  // Validate admin key
  if (providedKey !== adminKey) {
    securityLogger.logFailedAuth(ip, userAgent, 'Invalid admin key', req.path);
    return res.status(401).json({ 
      error: 'Invalid admin credentials',
      code: 'INVALID_ADMIN_KEY'
    });
  }

  // Validate admin verification token
  const tokenValidation = adminVerificationService.validateAdminToken(adminToken, ip, userAgent);
  if (!tokenValidation.valid) {
    securityLogger.logFailedAuth(ip, userAgent, `Invalid admin token: ${tokenValidation.message}`, req.path);
    return res.status(401).json({ 
      error: tokenValidation.message || 'Invalid admin token',
      code: 'INVALID_ADMIN_TOKEN'
    });
  }

  // Log successful authentication
  securityLogger.logAdminAuth(ip, userAgent, req.path);

  // Set user context for admin user
  req.user = {
    id: 'admin',
    email: tokenValidation.email || 'admin@readmyfineprint.com'
  };

  next();
}

/**
 * Optional user authentication middleware
 * Attempts to identify the user but doesn't require authentication
 */
export async function optionalUserAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { ip, userAgent } = getClientInfo(req);

    // Try to get user from JWT token using secure JWT service
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const validation = await secureJWTService.validateAccessToken(token);
        if (validation.valid && validation.payload) {
          const user = await databaseStorage.getUser(validation.payload.userId);
          if (user) {
            req.user = {
              id: user.id,
              email: user.email,
            };
            console.log(`🔑 User authenticated via secure JWT: ${user.email} (${user.id})`);
            return next();
          }
        } else if (validation.expired) {
          // Token is expired, could suggest refresh
          console.log('JWT token expired:', validation.error);
        } else {
          console.log('JWT token validation failed:', validation.error);
        }
      } catch (jwtError) {
        console.log('Error validating JWT token:', jwtError instanceof Error ? jwtError.message : 'Unknown error');
      }
    }

    // Fallback to session-based authentication (like /api/auth/session does)
    const sessionId = req.cookies?.sessionId;
    if (sessionId) {
      try {
        console.log('🔍 Checking session-based authentication...');
        
        // Get token from database using the same logic as /api/auth/session
        const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
        const token = await postgresqlSessionStorage.getTokenBySession(sessionId);
        
        if (token) {
          // Validate the token using hybrid token service
          const { hybridTokenService } = await import('./hybrid-token-service');
          const tokenData = await hybridTokenService.validateSubscriptionToken(token);
          
          if (tokenData && tokenData.userId) {
            // Get user data from database
            const user = await databaseStorage.getUser(tokenData.userId);
            if (user) {
              req.user = {
                id: user.id,
                email: user.email,
              };
              console.log(`🔑 User authenticated via session: ${user.email} (${user.id})`);
              return next();
            }
          }
        }
      } catch (sessionError) {
        console.log('Error validating session:', sessionError instanceof Error ? sessionError.message : 'Unknown error');
      }
    }

    // No authentication found, continue without user
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
 * Admin users must have valid subscription tokens and be on ultimate tier
 */
export async function requireAdminViaSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { ip, userAgent } = getClientInfo(req);
    let subscriptionToken = req.headers['x-subscription-token'] as string;
    let tokenData: any = null;

    // First try to get token from httpOnly cookie (more secure)
    subscriptionToken = req.cookies?.subscriptionToken;
    
    // Fallback to header for backward compatibility
    if (!subscriptionToken) {
      subscriptionToken = req.headers['x-subscription-token'] as string;
      if (subscriptionToken) {
        console.log(`⚠️ Using deprecated header-based subscription token (migrate to cookies)`);
      }
    }
    
    if (subscriptionToken) {
      const { hybridTokenService } = await import("./hybrid-token-service");
      tokenData = await hybridTokenService.validateSubscriptionToken(subscriptionToken);
    }

    // If no header token or invalid, try cookie session
    if (!tokenData) {
      const sessionId = req.cookies?.sessionId;
      if (sessionId) {
        try {
          const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
          const token = await postgresqlSessionStorage.getTokenBySession(sessionId);
          
          if (token) {
            const { hybridTokenService } = await import("./hybrid-token-service");
            tokenData = await hybridTokenService.validateSubscriptionToken(token);
            subscriptionToken = token; // Use the token from session
          }
        } catch (sessionError) {
          console.error('Session validation error:', sessionError);
        }
      }
    }

    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid subscription token' });
    }

    if (!tokenData.userId) {
      console.error('Token validation successful but userId is undefined:', tokenData);
      return res.status(401).json({ error: 'Invalid token: missing user ID' });
    }

    // Try to get user from database, but handle connection failures gracefully
    let user: any = null;
    let subscriptionData: any = null;
    let databaseAvailable = true;

    try {
      user = await databaseStorage.getUser(tokenData.userId);

      // Additional security: Verify user has an active, legitimate subscription
      const { subscriptionService } = await import("./subscription-service");
      subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(tokenData.userId);
    } catch (dbError: any) {
      console.error('Database connection error during admin auth:', dbError);
      databaseAvailable = false;

      // Check if this is a connection termination error
      if (dbError.message?.includes('terminating connection') || 
          dbError.cause?.message?.includes('terminating connection') ||
          dbError.code === '57P01') {
        console.log('Database connection terminated, proceeding with token-based admin verification');
      } else {
        throw dbError; // Re-throw if it's not a connection issue
      }
    }

    // If database is available, perform full verification
    if (databaseAvailable && user && subscriptionData) {
      // Check if user is admin by email
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
      if (!adminEmails.includes(user.email)) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.HIGH,
          message: `Non-admin user attempted admin access via subscription token`,
          ip,
          userAgent,
          endpoint: req.path,
          details: {
            userId: user.id,
            email: user.email,
            tokenUsed: true,
            attemptedEndpoint: req.path
          }
        });
        return res.status(403).json({ error: 'Admin access denied' });
      }

      // Admin users must have valid subscription - no free tier admin access
      if (!subscriptionData.subscription || subscriptionData.tier.id === 'free') {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.HIGH,
          message: `Admin user ${user.email} attempted access without valid paid subscription`,
          ip,
          userAgent,
          endpoint: req.path,
          details: {
            userId: user.id,
            email: user.email,
            currentTier: subscriptionData.tier.id,
            hasSubscription: !!subscriptionData.subscription
          }
        });
        return res.status(403).json({ error: 'Admin access requires valid subscription' });
      }

      req.user = {
        id: user.id,
        email: user.email
      };
    } else {
      // Database unavailable - use token-based verification as fallback
      console.log('Using token-based admin verification due to database unavailability');

      // Extract admin status from token data if available
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];

      // SECURITY: Removed hardcoded admin user ID fallback
      // Admin access now requires database verification - no hardcoded bypasses
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.HIGH,
        message: `Admin access denied during database outage - no fallback allowed`,
        ip,
        userAgent,
        endpoint: req.path,
        details: {
          userId: tokenData.userId,
          tokenUsed: true,
          databaseAvailable: false,
          attemptedEndpoint: req.path,
          securityReason: 'Database verification required for admin access'
        }
      });
      return res.status(503).json({ 
        error: 'Admin access temporarily unavailable - database connection required for security verification',
        code: 'DATABASE_VERIFICATION_REQUIRED' 
      });
    }

    // Log successful admin authentication (skip for dashboard auto-refresh)
    const isDashboardAutoRefresh = req.headers['x-dashboard-auto-refresh'] === 'true';
    if (!isDashboardAutoRefresh) {
      const authMethod = databaseAvailable ? 'via subscription token' : 'via token fallback';
      securityLogger.logAdminAuth(ip, userAgent, req.path + ` (${authMethod})`);
    }

    next();
  } catch (error) {
    const { ip, userAgent } = getClientInfo(req);
    console.error('Admin auth error:', error);
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.ERROR,
      severity: SecuritySeverity.CRITICAL,
      message: 'Admin authentication system error',
      ip,
      userAgent,
      endpoint: req.path,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Generate JWT token pair for user (DEPRECATED - use secureJWTService instead)
 * @deprecated Use secureJWTService.generateTokenPair() for enhanced security
 */
export async function generateJWT(userId: string, email?: string): Promise<string> {
  console.warn('⚠️  generateJWT is deprecated. Use secureJWTService.generateTokenPair() for enhanced security.');

  // Get user email if not provided
  if (!email) {
    const user = await databaseStorage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    email = user.email;
  }

  // Use secure JWT service for token generation
  const tokenPair = await secureJWTService.generateTokenPair(userId, email);
  return tokenPair.accessToken;
}

/**
 * Generate secure JWT token pair with refresh token
 */
export async function generateSecureTokenPair(userId: string, email: string, clientInfo: {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
} = {}) {
  return await secureJWTService.generateTokenPair(userId, email, clientInfo);
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string, clientInfo: {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
} = {}) {
  return await secureJWTService.refreshAccessToken(refreshToken, clientInfo);
}

/**
 * Revoke JWT token
 */
export async function revokeJWTToken(token: string, reason: string, revokedBy: string = 'user') {
  return await secureJWTService.revokeToken(token, reason, revokedBy);
}

/**
 * Revoke all tokens for a user
 */
export async function revokeAllUserTokens(userId: string, reason: string, revokedBy: string = 'user') {
  return await secureJWTService.revokeAllUserTokens(userId, reason, revokedBy);
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

    // Skip consent check for admin users using traditional admin auth
    if (adminKey && (providedKey === adminKey || adminToken)) {
      return next();
    }

    // Check if this is an admin user via subscription token (try cookie first, then header)
    let subscriptionToken = req.cookies?.subscriptionToken;
    if (!subscriptionToken) {
      subscriptionToken = req.headers['x-subscription-token'] as string;
    }
    
    if (subscriptionToken) {
      try {
        const { hybridTokenService } = await import("./hybrid-token-service");
        const tokenData = await hybridTokenService.validateSubscriptionToken(subscriptionToken);

        if (tokenData) {
          const user = await databaseStorage.getUser(tokenData.userId);

          // Check if user is admin by email
          const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
          if (user && adminEmails.includes(user.email)) {
            // Admin user via subscription token - skip consent check
            return next();
          }
        }
      } catch (tokenError) {
        console.error('Error validating admin subscription token in consent check:', tokenError);
        // Continue to normal consent check if token validation fails
      }
    }

    // Skip consent check for sample contract operations
    if (isSampleContractRequest(req)) {
      return next();
    }

    // Check for valid consent with user ID if available
    const userId = (req as any).user?.id;
    const sessionId = (req as any).sessionId;
    const consentProof = await consentLogger.verifyUserConsent(ip, userAgent, userId, sessionId);

    if (!consentProof) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHORIZATION,
        severity: SecuritySeverity.HIGH,
        message: `Access denied - no valid consent found for ${req.path}`,
        ip,
        userAgent,
        endpoint: req.path
      });

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

/**
 * Check if the request is for sample contract functionality
 */
function isSampleContractRequest(req: Request): boolean {
  const path = req.path;
  const body = req.body;

  // Allow sample contract creation (when title contains sample contract keywords)
  if (path === '/api/documents' && req.method === 'POST') {
    const title = body?.title || '';
    const sampleKeywords = [
      'sample', 'example', 'demo', 'template',
      'residential lease', 'employment agreement', 'nda',
      'service agreement', 'rental agreement'
    ];

    return sampleKeywords.some(keyword => 
      title.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // Allow accessing documents that are sample contracts
  if (path.startsWith('/api/documents/') && req.method === 'GET') {
    // This will be allowed but we'll need to verify in the route handler
    // that it's actually a sample contract
    return false; // Let the route handler decide based on document content
  }

  return false;
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

  // Additional security headers
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Enhanced Content Security Policy with comprehensive security directives
  // In development, allow Replit scripts; in production, restrict further
  const isDevelopment = process.env.NODE_ENV === 'development';
  const replitSources = isDevelopment ? ' https://replit.com' : '';

  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    `script-src 'self' https://js.stripe.com https://m.stripe.com${replitSources}; ` +
    `script-src-elem 'self' https://js.stripe.com https://m.stripe.com${replitSources}; ` +
    "style-src 'self' https://js.stripe.com; " +
    "img-src 'self' data: https://img.shields.io https://js.stripe.com; " +
    `connect-src 'self' https://api.openai.com https://api.stripe.com https://js.stripe.com https://m.stripe.com${replitSources}; ` +
    "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self' https://js.stripe.com https://api.stripe.com; " +
    "frame-ancestors 'none'; " +
    "upgrade-insecure-requests; " +
    "report-uri /api/security/csp-report; " +
    "report-to csp-endpoint;"
  );

  next();
}