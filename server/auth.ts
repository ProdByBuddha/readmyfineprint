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
      cookies?: Record<string, string>;
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

/**
 * Unified token validation that handles both access and subscription tokens
 * Detects token type and routes to appropriate validation method
 */
async function validateTokenUnified(token: string): Promise<{ userId: string; tierId?: string; tier?: string; email?: string } | null> {
  try {
    // First, extract token payload to determine type without full validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('❌ Invalid token format - not a JWT');
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as any;
    const tokenType = payload.tokenType;

    console.log(`🔍 Token validation - detected tokenType: ${tokenType}, audience: ${payload.aud}`);

    if (tokenType === 'access') {
      // This is an access token, validate using JOSE auth service
      const { joseAuthService } = await import('./jose-auth-service');
      const validation = await joseAuthService.validateAccessToken(token, payload.aud || 'api');
      
      if (validation.valid && validation.payload) {
        console.log(`✅ Access token validation successful for user: ${validation.payload.userId}`);
        return {
          userId: validation.payload.userId,
          email: validation.payload.email,
          // For access tokens, we don't have tier info directly, so we'll need to look it up
        };
      } else {
        console.log(`❌ Access token validation failed: ${validation.error}`);
        return null;
      }
    } else if (tokenType === 'subscription') {
      // This is a subscription token, validate using JOSE token service
      const { joseTokenService } = await import('./jose-token-service');
      const subscriptionData = await joseTokenService.validateSubscriptionToken(token);
      
      if (subscriptionData) {
        console.log(`✅ Subscription token validation successful for user: ${subscriptionData.userId}`);
        return {
          userId: subscriptionData.userId,
          tierId: subscriptionData.tierId,
          tier: subscriptionData.tier,
        };
      } else {
        console.log('❌ Subscription token validation failed');
        return null;
      }
    } else {
      // Unknown token type, try both validation methods as fallback
      console.log(`⚠️ Unknown token type: ${tokenType}, trying fallback validation`);
      
      // Try subscription token validation first
      try {
        const { joseTokenService } = await import('./jose-token-service');
        const subscriptionData = await joseTokenService.validateSubscriptionToken(token);
        if (subscriptionData) {
          console.log(`✅ Fallback subscription token validation successful`);
          return {
            userId: subscriptionData.userId,
            tierId: subscriptionData.tierId,
            tier: subscriptionData.tier,
          };
        }
      } catch (subError) {
        console.log('❌ Fallback subscription token validation failed');
      }

      // Try access token validation as final fallback
      try {
        const { joseAuthService } = await import('./jose-auth-service');
        const validation = await joseAuthService.validateAccessToken(token, payload.aud || 'api');
        if (validation.valid && validation.payload) {
          console.log(`✅ Fallback access token validation successful`);
          return {
            userId: validation.payload.userId,
            email: validation.payload.email,
          };
        }
      } catch (accessError) {
        console.log('❌ Fallback access token validation failed');
      }
      
      return null;
    }
  } catch (error) {
    console.error('❌ Unified token validation error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Simple admin authentication middleware
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);

  console.log(`🔍 Admin auth attempt for ${req.path}`);

  const authHeader = req.headers.authorization as string;

  // Check for Bearer token (JWT access token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwtToken = authHeader.substring(7);
    try {
      const { joseAuthService } = await import('./jose-auth-service');
      
      // Validate the JWT token with expected audience 'api'
      const validation = await joseAuthService.validateAccessToken(jwtToken, 'api');
      
      if (validation.valid && validation.payload) {
        const user = await databaseStorage.getUser(validation.payload.userId);
        if (user) {
          const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
          if (adminEmails.includes(user.email)) {
            console.log(`✅ Admin access granted via JWT: ${user.email}`);
            securityLogger.logAdminAuth(ip, userAgent, req.path + ' (JWT admin)');
            req.user = {
              id: user.id,
              email: user.email,
            };
            return next();
          } else {
            console.log(`❌ User ${user.email} is not an admin`);
          }
        }
      } else {
        console.log('JWT validation failed:', validation.error || 'Invalid token');
      }
    } catch (jwtError) {
      console.log('JWT admin validation failed:', jwtError);
    }
  }

  // In development mode, also check for session-based admin authentication
  if (process.env.NODE_ENV === 'development') {
    try {
      // Check cookies for admin session
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        const cookies: Record<string, string> = {};
        cookieHeader.split(';').forEach((cookie) => {
          const parts = cookie.trim().split('=');
          if (parts.length === 2) {
            cookies[parts[0]] = decodeURIComponent(parts[1]);
          }
        });
        
        const subscriptionToken = cookies.subscriptionToken;
        if (subscriptionToken) {
          const { joseAuthService } = await import('./jose-auth-service');
          const validation = await joseAuthService.validateSubscriptionToken(subscriptionToken);
          
          if (validation.valid && validation.payload) {
            const user = await databaseStorage.getUser(validation.payload.userId);
            if (user) {
              const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
              if (adminEmails.includes(user.email)) {
                console.log(`✅ Admin access granted via session token in dev mode: ${user.email}`);
                securityLogger.logAdminAuth(ip, userAgent, req.path + ' (session token dev)');
                req.user = {
                  id: user.id,
                  email: user.email,
                };
                return next();
              }
            }
          }
        }
      }
    } catch (sessionError) {
      console.log('Session admin check failed in dev mode:', sessionError);
    }
  }

  securityLogger.logFailedAuth(ip, userAgent, 'Admin authentication required', req.path);
  return res.status(401).json({
    error: 'Admin authentication required. Please log in to access this resource.',
    code: 'AUTHENTICATION_REQUIRED'
  });
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
        const validation = await joseAuthService.validateAccessToken(token, 'api');
        if (validation.valid && validation.payload) {
          const user = await databaseStorage.getUser(validation.payload.userId);
          if (user) {
            req.user = {
              id: user.id,
              email: user.email,
            };
            console.log(`🔑 User authenticated via secure JWT: ${user.email} (${user.id})`);
        console.log(`[DEBUG] optionalUserAuth - JWT Access Token Validation: Valid=${validation.valid}, UserID=${validation.payload?.userId}, Email=${validation.payload?.email}`);
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

    // If no user found from Bearer token, try session-based authentication
    if (!req.user) {
      let sessionId: string | undefined;
      if (req.headers.cookie) {
        const cookies = parseCookies(req.headers.cookie);
        sessionId = cookies['sessionId'];
      }
      if (sessionId) {
        try {
          console.log('🔍 Checking session-based authentication...');

          const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
          const sessionToken = await postgresqlSessionStorage.getTokenBySession(sessionId);

          if (sessionToken) {
            try {
              // Try validating using unified validation that handles both token types
              const tokenData = await validateTokenUnified(sessionToken);
              if (tokenData && tokenData.userId) {
                const user = await databaseStorage.getUser(tokenData.userId);
                if (user) {
                  req.user = {
                    id: user.id,
                    email: user.email,
                  };
                  console.log(`🔑 User authenticated via session token: ${user.email} (${user.id})`);
                }
              }
            } catch (sessionTokenError) {
              console.log('Session token validation failed:', sessionTokenError instanceof Error ? sessionTokenError.message : 'Unknown error');
              // If token validation fails, clean up the invalid token
              try {
                await postgresqlSessionStorage.removeSessionToken(sessionId);
                console.log('🧹 Cleaned up invalid session token from database');
              } catch (cleanupError) {
                console.error('⚠️ Failed to clean up invalid session token:', cleanupError);
              }
            }
          }
        } catch (sessionError) {
          console.log('Error validating session:', sessionError instanceof Error ? sessionError.message : 'Unknown error');
        }
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

    // First try JWT token authentication (for admin users logged in via JWT)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwtToken = authHeader.substring(7);
      try {
        const { joseAuthService } = await import('./jose-auth-service');
        const validation = await joseAuthService.validateAccessToken(jwtToken, 'api');
        if (validation.valid && validation.payload) {
          const user = await databaseStorage.getUser(validation.payload.userId);
          if (user) {
            // Check if user is admin by email
            const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
            const isAdmin = adminEmails.includes(user.email);

            if (isAdmin) {
              console.log(`✅ Admin access granted via JWT: ${user.email}`);
              securityLogger.logAdminAuth(ip, userAgent, req.path + ' (JWT admin)');

              // Add user info to request for downstream use
              (req as any).user = {
                id: user.id,
                email: user.email,
                tier: 'admin',
                isAdmin: true
              };

              return next();
            }
          }
        }
      } catch (jwtError) {
        console.log('JWT admin validation failed, trying subscription token:', jwtError);
      }
    }

    // Fallback to subscription token authentication
    let adminSubscriptionToken = req.cookies?.subscriptionToken;

    // If no cookies object or subscriptionToken, try to parse manually from Cookie header
    if (!adminSubscriptionToken && req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      adminSubscriptionToken = cookies['subscriptionToken'];
    }

    // If no direct subscription token, try session-based token lookup (for development auto-login)
    if (!adminSubscriptionToken && req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      const sessionId = cookies['sessionId'];
      
      if (sessionId) {
        try {
          const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
          const sessionToken = await postgresqlSessionStorage.getTokenBySession(sessionId);
          
          if (sessionToken) {
            adminSubscriptionToken = sessionToken;
          }
        } catch (sessionError) {
          console.error('Error during session-based token lookup:', sessionError);
        }
      }
    }

    if (!adminSubscriptionToken) {
      securityLogger.logFailedAuth(ip, userAgent, 'Admin access denied: subscription token required', req.path);
      return res.status(401).json({ 
        error: 'Admin access denied: subscription token required',
        requiresSubscription: true 
      });
    }

    // Validate the token using unified validation that handles both access and subscription tokens
    const tokenData = await validateTokenUnified(adminSubscriptionToken);

    if (!tokenData || !tokenData.userId) {
      securityLogger.logFailedAuth(ip, userAgent, 'Invalid subscription token', req.path);
      return res.status(401).json({ 
        error: 'Invalid subscription token',
        requiresSubscription: true 
      });
    }

    // Get user data to check admin status
    const user = await databaseStorage.getUser(tokenData.userId);
    if (!user) {
      securityLogger.logFailedAuth(ip, userAgent, 'User not found for subscription token', req.path);
      return res.status(401).json({ 
        error: 'Invalid subscription token',
        requiresSubscription: true 
      });
    }

    // Check if user is admin by email
    const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
    const isAdmin = adminEmails.includes(user.email);

    if (!isAdmin) {
      // Check if user has admin or ultimate tier from subscription data
      // Note: The JOSE token stores tier as 'tierId', but we also check 'tier' for backwards compatibility
      const userTier = (tokenData.tierId || tokenData.tier) as string;
      if (!userTier || !['admin', 'ultimate'].includes(userTier)) {
        securityLogger.logFailedAuth(ip, userAgent, `Admin access denied: insufficient privileges (tier: ${userTier})`, req.path);
        return res.status(403).json({ 
          error: 'Admin access denied: insufficient privileges',
          userTier: userTier,
          requiredTier: 'admin or ultimate'
        });
      }
    }

    securityLogger.logAdminAuth(ip, userAgent, req.path + ' (subscription token)');

    // Add user info to request for downstream use
    (req as any).user = {
      id: user.id,
      email: user.email,
      tier: tokenData.tierId || tokenData.tier || 'admin',
      isAdmin: isAdmin
    };

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logFailedAuth(ip, userAgent, `Admin authentication failed: ${error}`, req.path);
    res.status(401).json({ 
      error: 'Authentication failed',
      requiresSubscription: true 
    });
  }
}



/**
 * Verify subscription token using JOSE token service
 */
export async function verifySubscriptionToken(token: string) {
  try {
    const { joseTokenService } = await import('./jose-token-service');
    return await joseTokenService.validateSubscriptionToken(token);
  } catch (error) {
    console.error('Error verifying subscription token:', error);
    return null;
  }
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
    // Get session ID from req.sessionId or fallback to header
    let sessionId = (req as any).sessionId;
    if (!sessionId) {
      sessionId = req.headers['x-session-id'] as string;
    }
    const consentProof = await consentLogger.verifyUserConsent(ip, userAgent, userId, sessionId);
    console.log(`🔍 Consent check - User: ${userId || 'none'}, Session: ${sessionId?.substring(0, 16) || 'none'}, Path: ${req.path}`);

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
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self "https://js.stripe.com" "https://m.stripe.com")');
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
        `style-src 'self' data: https://js.stripe.com https://fonts.googleapis.com${replitSources}${(isDevelopment || isStaging) ? " 'unsafe-inline'" : ''}; ` +
        `style-src-elem 'self' data: https://fonts.googleapis.com${replitSources}${(isDevelopment || isStaging) ? " 'unsafe-inline'" : ''}; ` +
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