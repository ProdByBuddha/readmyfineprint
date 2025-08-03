import { getClientInfo } from './security-logger';
import type { Request, Response, NextFunction } from 'express';

// Manual cookie parsing helper (consistent with server/index.ts)
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        try {
          cookies[key] = decodeURIComponent(value);
        } catch (error) {
          // If decoding fails, use raw value
          cookies[key] = value;
        }
      }
    });
  }

  return cookies;
}

// Extend Express Request type to include cookies
declare global {
  namespace Express {
    interface Request {
      cookies: Record<string, string>;
    }
  }
}

// Define extended request types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    isAdmin?: boolean;
  };
  sessionId?: string;
}
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { secureJWTService } from './secure-jwt-service';
import crypto from 'crypto';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';
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
        const { joseAuthService } = await import('./jose-auth-service');
        const validation = await joseAuthService.validateAccessToken(jwtToken);
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

  // Try session-based authentication first (for staging/production)
  let sessionAuthenticated = false;

  // Manual cookie parsing fallback (same as other endpoints)
  // Manual cookie parsing fallback (same as other endpoints)
  let sessionId: string | undefined;
  if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    sessionId = cookies['sessionId'];
  }

  if (sessionId) {
    try {
      const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
      const token = await postgresqlSessionStorage.getTokenBySession(sessionId);

      if (token) {
        const { joseTokenService } = await import('./jose-token-service');
        const tokenData = await joseTokenService.validateSubscriptionToken(token);

        if (tokenData && tokenData.userId) {
          const { databaseStorage } = await import('./storage');
          const authenticatedUser = await databaseStorage.getUser(tokenData.userId);

          if (authenticatedUser) {
            // Check if user is admin by email
            const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
            if (adminEmails.includes(authenticatedUser.email)) {
              console.log(`✅ Legacy admin auth: Session authenticated as: ${authenticatedUser.email}`);
              securityLogger.logAdminAuth(ip, userAgent, req.path + ' (session)');
              req.user = {
                id: authenticatedUser.id,
                email: authenticatedUser.email
              };
              sessionAuthenticated = true;
            } else {
              console.log(`❌ Legacy admin auth: User ${authenticatedUser.email} is not an admin`);
            }
          }
        }
      }
    } catch (sessionError) {
      console.log('Legacy admin auth session validation error:', sessionError);
    }
  }

  if (sessionAuthenticated) {
    return next();
  }

  // Fall back to traditional admin key + token authentication
  console.log(`🔍 Session auth failed, trying traditional admin auth for ${req.path}`);

  if (!providedKey || !adminToken) {
    securityLogger.logFailedAuth(ip, userAgent, 'Missing admin credentials and no valid session', req.path);
    return res.status(401).json({ 
      error: 'Admin authentication required. Session-based auth failed and admin key/token missing.',
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
  securityLogger.logAdminAuth(ip, userAgent, req.path + ' (traditional)');

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
        const { joseAuthService } = await import('./jose-auth-service');
        const validation = await joseAuthService.validateAccessToken(token);
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
    let sessionId: string | undefined;
    if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      sessionId = cookies['sessionId'];
    }
    if (sessionId) {
      try {
        console.log('🔍 Checking session-based authentication...');

        // Get token from database using the same logic as /api/auth/session
        const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
        const token = await postgresqlSessionStorage.getTokenBySession(sessionId);

        if (token) {
          // Validate the subscription token (used for admin sessions)
          const { joseTokenService } = await import('./jose-token-service');
          const tokenData = await joseTokenService.validateSubscriptionToken(token);

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
          } else if (token && !tokenData) {
            // Token exists but is invalid - clean it up
            try {
              const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
              await postgresqlSessionStorage.removeSessionToken(sessionId);
              console.log('🧹 Cleaned up invalid session token in auth middleware');
            } catch (cleanupError) {
              console.error('⚠️ Failed to clean up invalid session token:', cleanupError);
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
    let subscriptionToken: string | undefined = req.headers['x-subscription-token'] as string;
    let tokenData: any = null;

    // Debug logging for admin authentication
    console.log(`🔍 Admin auth via subscription for ${req.path}`);
    console.log(`🔍 Headers: subscription-token=${subscriptionToken ? 'present' : 'missing'}, cookie=${req.headers.cookie ? 'present' : 'missing'}`);
    let sessionId: string | undefined;

    // First try to get token from httpOnly cookie (more secure)

    if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      subscriptionToken = cookies['subscriptionToken'];
      sessionId = cookies['sessionId'];
    }

    // Fallback to header for backward compatibility
    if (!subscriptionToken) {
      subscriptionToken = req.headers['x-subscription-token'] as string;
      if (subscriptionToken) {
        console.log(`⚠️ Using deprecated header-based subscription token (migrate to cookies)`);
      }
    }

    if (subscriptionToken) {
      const { joseTokenService } = await import('./jose-token-service');
      tokenData = await joseTokenService.validateSubscriptionToken(subscriptionToken);
    }

    // If no subscription token, try JWT Authorization header
    if (!tokenData) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwtToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log(`🔍 Admin auth: Trying JWT token validation`);

        try {
          // Try access token validation first (more likely for admin sessions)
          const { joseAuthService } = await import('./jose-auth-service');
          const accessValidation = await joseAuthService.validateAccessToken(jwtToken);

          if (accessValidation.valid && accessValidation.payload) {
            // Create subscription token-like data from access token
            tokenData = {
              userId: accessValidation.payload.userId,
              tierId: 'ultimate', // Admin users have ultimate tier
              subscriptionId: 'admin-jwt'
            };
            subscriptionToken = jwtToken;
            console.log(`✅ Admin auth: JWT validation successful for user ${tokenData.userId} via access token`);
          } else {
            // Fallback to subscription token validation
            const { joseTokenService } = await import('./jose-token-service');
            tokenData = await joseTokenService.validateSubscriptionToken(jwtToken);

            if (tokenData) {
              console.log(`✅ Admin auth: JWT validation successful for user ${tokenData.userId} via subscription token`);
              subscriptionToken = jwtToken;
            } else {
              console.log(`❌ Admin auth: JWT validation failed`);
            }
          }
        } catch (jwtError) {
          console.log(`❌ Admin auth: JWT validation error:`, jwtError);
        }
      }
    }

    // If no header token or invalid, try cookie session
    if (!tokenData) {
      // Manual cookie parsing fallback (same as other endpoints)
      let sessionId: string | undefined;
      if (req.headers.cookie) {
        const cookies = parseCookies(req.headers.cookie);
        sessionId = cookies['sessionId'];
      }

      if (sessionId) {
        try {
          const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
          const token = await postgresqlSessionStorage.getTokenBySession(sessionId);

          if (token) {
            // First try to validate as access token (more likely for admin sessions)
            const { joseAuthService } = await import('./jose-auth-service');
            const accessValidation = await joseAuthService.validateAccessToken(token);

            if (accessValidation.valid && accessValidation.payload) {
              // Create subscription token-like data from access token
              tokenData = {
                userId: accessValidation.payload.userId,
                tierId: 'ultimate', // Admin users have ultimate tier
                subscriptionId: 'admin-session'
              };
              subscriptionToken = token;
              console.log(`✅ Admin auth: Session resolved to user ${tokenData.userId} via access token`);
            } else {
              // Fallback to subscription token validation
              const { joseTokenService } = await import('./jose-token-service');
              tokenData = await joseTokenService.validateSubscriptionToken(token);

              if (tokenData) {
                subscriptionToken = token;
                console.log(`✅ Admin auth: Session resolved to user ${tokenData.userId}, tier: ${tokenData.tierId}`);
              } else {
                console.log(`❌ Admin auth: Token validation failed for session ${sessionId.slice(0, 8)}...`);
                // Token is invalid - clean it up
                try {
                  await postgresqlSessionStorage.removeSessionToken(sessionId);
                  console.log('🧹 Cleaned up invalid admin session token');
                } catch (cleanupError) {
                  console.error('⚠️ Failed to clean up invalid admin session token:', cleanupError);
                }
              }
            }
          } else {
            console.log(`❌ Admin auth: No token found for session ${sessionId.slice(0, 8)}...`);
          }
        } catch (sessionError) {
          console.error('Admin auth session validation error:', sessionError);
        }
      } else {
        console.log('❌ Admin auth: No session ID found in cookies or headers');
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

  // Use JOSE auth service for token generation
  const { joseAuthService } = await import('./jose-auth-service');
  const tokenPair = await joseAuthService.generateTokenPair(userId, email);
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
  const { joseAuthService } = await import('./jose-auth-service');
  return await joseAuthService.generateTokenPair(userId, email, clientInfo);
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string, clientInfo: {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
} = {}) {
  const { joseAuthService } = await import('./jose-auth-service');
  return await joseAuthService.refreshAccessToken(refreshToken, clientInfo);
}

/**
 * Revoke JWT token
 */
export async function revokeJWTToken(token: string, reason: string, revokedBy: string = 'user') {
  const { joseAuthService } = await import('./jose-auth-service');
  return await joseAuthService.revokeToken(token, reason, revokedBy);
}

/**
 * Revoke all tokens for a user
 */
export async function revokeAllUserTokens(userId: string, reason: string, revokedBy: string = 'user') {
  // For now, still use secureJWTService for bulk revocation since it handles database operations
  return await secureJWTService.revokeAllUserTokens(userId, reason, revokedBy);
}

/**
 * Require security questions middleware
 * Ensures that users have set up security questions before accessing protected endpoints
 * New users and users without security questions are redirected to setup
 */
export async function requireSecurityQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { ip, userAgent } = getClientInfo(req);

    // Skip for admin users
    const adminKey = process.env.ADMIN_API_KEY;
    const providedKey = req.headers['x-admin-key'] as string;
    const adminToken = req.headers['x-admin-token'] as string;

    if (adminKey && (providedKey === adminKey || adminToken)) {
      return next();
    }

    // Check if this is an admin user via subscription token
    let subscriptionToken: string | undefined;
    if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      subscriptionToken = cookies['subscriptionToken'];
    } else {
      subscriptionToken = req.headers['x-subscription-token'] as string;
    }

    if (subscriptionToken) {
      try {
        const { joseTokenService } = await import('./jose-token-service');
        const tokenData = await joseTokenService.validateSubscriptionToken(subscriptionToken);

        if (tokenData) {
          const user = await databaseStorage.getUser(tokenData.userId);
          const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
          if (user && adminEmails.includes(user.email)) {
            return next();
          }
        }
      } catch (tokenError) {
        console.error('Error validating admin subscription token in security questions check:', tokenError);
      }
    }

    // Get user ID from request (should be set by requireUserAuth middleware)
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Check if user is admin (admins are exempt from security questions requirement)
    try {
      const user = await databaseStorage.getUser(userId);
      if (user && user.isAdmin) {
        console.log(`Admin user ${user.email} bypassing security questions requirement`);
        return next();
      }
    } catch (adminCheckError) {
      console.error('Error checking admin status:', adminCheckError);
      // Continue with security questions check if admin check fails
    }

    // Check user's subscription tier to determine if security questions are required
    try {
      const { subscriptionService } = await import('./subscription-service');
      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(userId);

      // Free tier users don't need security questions
      if (!subscriptionData || subscriptionData.tier.id === 'free') {
        console.log(`Free tier user ${userId} bypassing security questions requirement`);
        return next();
      }

      // Paid tier users need security questions
      console.log(`Checking security questions for ${subscriptionData.tier} tier user ${userId}`);
      const { securityQuestionsService } = await import('./security-questions-service');
      const hasSecurityQuestions = await securityQuestionsService.hasSecurityQuestions(userId);

      if (!hasSecurityQuestions) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHORIZATION,
          severity: SecuritySeverity.MEDIUM,
          message: `Access denied - security questions required for ${subscriptionData.tier} tier user on ${req.path}`,
          ip,
          userAgent,
          endpoint: req.path,
          details: { userId, tier: subscriptionData.tier }
        });

        return res.status(403).json({
          error: 'Security questions required',
          message: 'You must set up security questions to access this feature as a subscribed user',
          code: 'SECURITY_QUESTIONS_REQUIRED',
          requiresSecurityQuestions: true
        });
      }
    } catch (tierCheckError) {
      console.error('Error checking user subscription tier for security questions:', tierCheckError);
      // If we can't determine tier, default to allowing access (fail open for free tier)
      console.log(`Unable to determine tier for user ${userId}, allowing access`);
      return next();
    }

    next();
  } catch (error) {
    console.error('Error checking security questions requirement:', error);
    return res.status(500).json({
      error: 'Unable to verify security questions',
      message: 'Please try again or contact support',
      code: 'SECURITY_QUESTIONS_VERIFICATION_ERROR'
    });
  }
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
    let subscriptionToken: string | undefined;

    if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      subscriptionToken = cookies['subscriptionToken'];
    } else {
      subscriptionToken = req.headers['x-subscription-token'] as string;
    }

    if (subscriptionToken) {
      try {
        const { joseTokenService } = await import('./jose-token-service');
        const tokenData = await joseTokenService.validateSubscriptionToken(subscriptionToken);

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
  }```text

  return false;
}

// Middleware to add security headers
export function addSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Override multiple response methods to ensure headers are ALWAYS set
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  const originalWrite = res.write;

  // Function to set all security headers
  const setSecurityHeaders = () => {
    if (!res.headersSent) {
      // Prevent clickjacking - CRITICAL for security scans
      res.setHeader('X-Frame-Options', 'DENY');

      // Prevent MIME type sniffing - CRITICAL for security scans  
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Enable XSS protection
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Referrer policy - use the most secure setting
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      // HSTS (HTTP Strict Transport Security)
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

      // Additional security headers
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self https://js.stripe.com https://m.stripe.com)');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Enhanced Content Security Policy - CRITICAL for security scans
      const isDevelopment = process.env.NODE_ENV === 'development';
      const isStaging = process.env.NODE_ENV === 'staging';
      const replitSources = (isDevelopment || isStaging) ? ' https://replit.com https://*.replit.com https://*.replit.dev https://*.kirk.replit.dev https://cdn.jsdelivr.net' : '';
      const localhostSources = isDevelopment ? ' http://localhost:5173 http://localhost:5000 http://127.0.0.1:5173 http://127.0.0.1:5000 https://*.kirk.replit.dev:5173' : '';
      const websocketSources = (isDevelopment || isStaging) ? ' ws://localhost:5173 wss://localhost:5173 wss://*.replit.dev wss://*.kirk.replit.dev' : '';

      const cspValue = "default-src 'none'; " +
        `script-src 'self' https://js.stripe.com https://m.stripe.com${replitSources}; ` +
        `script-src-elem 'self' https://js.stripe.com https://m.stripe.com${replitSources}; ` +
        `style-src 'self' data: https://js.stripe.com https://fonts.googleapis.com${replitSources}${(isDevelopment || isStaging) ? " 'unsafe-inline' 'sha256-+OsIn6RhyCZCUkkvtHxFtP0kU3CGdGeLjDd9Fzqdl3o='" : ''}; ` +
        `style-src-elem 'self' data: https://fonts.googleapis.com${replitSources}${(isDevelopment || isStaging) ? " 'sha256-+OsIn6RhyCZCUkkvtHxFtP0kU3CGdGeLjDd9Fzqdl3o='" : ''}; ` +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https://img.shields.io https://js.stripe.com; " +
        `connect-src 'self' https://api.openai.com https://api.stripe.com https://js.stripe.com https://m.stripe.com${replitSources}${localhostSources}${websocketSources}; ` +
        "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.com; " +
        "media-src 'self'; " +
        "manifest-src 'self'; " +
        "worker-src 'self'; " +
        "child-src 'none'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self' https://js.stripe.com https://api.stripe.com; " +
        "frame-ancestors 'none'; " +
        "upgrade-insecure-requests; " +
        "report-uri /api/security/csp-report; " +
        "report-to csp-endpoint;";

      res.setHeader('Content-Security-Policy', cspValue);

      // Log header setting for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔒 Security headers set for ${req.method} ${req.path}`);
      }
    }
  };

  // Override res.send
  res.send = function(body?: any) {
    setSecurityHeaders();
    return originalSend.call(this, body);
  };

  // Override res.json
  res.json = function(body?: any) {
    setSecurityHeaders();
    return originalJson.call(this, body);
  };

  // Override res.end
  res.end = function(chunk?: any, encoding?: any) {
    setSecurityHeaders();
    return originalEnd.call(this, chunk, encoding);
  };

  // Override res.write
  res.write = function(chunk: any, encoding?: any) {
    setSecurityHeaders();
    return originalWrite.call(this, chunk, encoding);
  };

  // Set headers immediately as well
  setSecurityHeaders();

  next();
}