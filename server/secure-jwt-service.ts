/**
 * Secure JWT Service
 * Implements proper JWT management with refresh tokens, versioned secrets, and persistent revocation
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { jwtSecretManager } from './jwt-secret-manager';
import { securityLogger, SecurityEventType, SecuritySeverity, getClientInfo } from './security-logger';
import { ensureDbInitialized } from './db';
import { eq, and, lt } from 'drizzle-orm';

// Import database and schema after ensuring initialization
let db: any;
let jwtTokenRevocations: any;
let refreshTokens: any;
let jwtSecretVersions: any;

async function initializeDatabase() {
  if (!db) {
    await ensureDbInitialized();
    const dbModule = await import('./db');
    const schemaModule = await import('@shared/schema');
    db = dbModule.db;
    jwtTokenRevocations = schemaModule.jwtTokenRevocations;
    refreshTokens = schemaModule.refreshTokens;
    jwtSecretVersions = schemaModule.jwtSecretVersions;
  }
}

interface AccessTokenPayload {
  userId: string;
  email: string;
  tokenType: 'access';
  version: number;
  jti: string;
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  userId: string;
  tokenType: 'refresh';
  version: number;
  jti: string;
  iat: number;
  exp: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
}

interface TokenValidationResult {
  valid: boolean;
  payload?: AccessTokenPayload;
  expired?: boolean;
  revoked?: boolean;
  error?: string;
}

export class SecureJWTService {
  private initialized: boolean = false;
  private readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
  private readonly MAX_REFRESH_TOKENS_PER_USER = 5; // Limit concurrent sessions

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await jwtSecretManager.initialize();
      await initializeDatabase();
      this.initialized = true;

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.LOW,
        message: 'Secure JWT Service initialized',
        ip: 'system',
        userAgent: 'secure-jwt-service',
        endpoint: 'initialization'
      });

      console.log('✅ Secure JWT Service initialized with refresh token support');
    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.CRITICAL,
        message: 'Failed to initialize Secure JWT Service',
        ip: 'system',
        userAgent: 'secure-jwt-service',
        endpoint: 'initialization',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(userId: string, email: string, clientInfo: {
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  } = {}): Promise<TokenPair> {
    await this.ensureInitialized();

    try {
      const { secret, version, algorithm } = jwtSecretManager.getCurrentSecret();
      const now = Math.floor(Date.now() / 1000);
      
      // Generate unique JTIs
      const accessJti = crypto.randomUUID();
      const refreshJti = crypto.randomUUID();

      // Calculate expiration times
      const accessExp = now + (15 * 60); // 15 minutes
      const refreshExp = now + (7 * 24 * 60 * 60); // 7 days

      // Access token payload
      const accessPayload: AccessTokenPayload = {
        userId,
        email,
        tokenType: 'access',
        version,
        jti: accessJti,
        iat: now,
        exp: accessExp
      };

      // Refresh token payload
      const refreshPayload: RefreshTokenPayload = {
        userId,
        tokenType: 'refresh',
        version,
        jti: refreshJti,
        iat: now,
        exp: refreshExp
      };

      // Sign tokens (don't use expiresIn since we set exp manually)
      const accessToken = jwt.sign(accessPayload, secret, {
        algorithm: algorithm as jwt.Algorithm
      });

      const refreshToken = jwt.sign(refreshPayload, secret, {
        algorithm: algorithm as jwt.Algorithm
      });

      // Store refresh token in database (skip in mock mode)
      const refreshExpiry = new Date(refreshExp * 1000);
      if (!(process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL)) {
        const refreshTokenHash = this.hashToken(refreshToken);

        await db.insert(refreshTokens).values({
          tokenHash: refreshTokenHash,
          userId,
          deviceFingerprint: clientInfo.deviceFingerprint,
          ipAddress: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          expiresAt: refreshExpiry
        });
      }

      // Clean up old refresh tokens for this user
      await this.cleanupUserRefreshTokens(userId);

      const accessExpiry = new Date(accessExp * 1000);

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.LOW,
        message: 'JWT token pair generated',
        ip: clientInfo.ip || 'unknown',
        userAgent: clientInfo.userAgent || 'unknown',
        endpoint: 'token-generation',
        details: {
          userId,
          secretVersion: version,
          accessExpiry: accessExpiry.toISOString(),
          refreshExpiry: refreshExpiry.toISOString()
        }
      });

      return {
        accessToken,
        refreshToken,
        accessTokenExpiry: accessExpiry,
        refreshTokenExpiry: refreshExpiry
      };

    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'Failed to generate JWT token pair',
        ip: clientInfo.ip || 'unknown',
        userAgent: clientInfo.userAgent || 'unknown',
        endpoint: 'token-generation',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    await this.ensureInitialized();

    try {
      // First decode without verification to get version
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return { valid: false, error: 'Invalid token format' };
      }

      const payload = decoded.payload as any;
      const version = payload.version || 1;

      // Check if token is revoked
      if (await this.isTokenRevoked(payload.jti)) {
        return { valid: false, revoked: true, error: 'Token has been revoked' };
      }

      // Get secret for this version
      const secretInfo = jwtSecretManager.getSecretByVersion(version);
      if (!secretInfo) {
        return { valid: false, error: 'Secret version not found' };
      }

      // Verify token
      const verifiedPayload = jwt.verify(token, secretInfo.secret, {
        algorithms: [secretInfo.algorithm as jwt.Algorithm]
      }) as AccessTokenPayload;

      // Validate token type
      if (verifiedPayload.tokenType !== 'access') {
        return { valid: false, error: 'Invalid token type' };
      }

      return { valid: true, payload: verifiedPayload };

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, expired: true, error: 'Token expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid token signature' };
      }
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, clientInfo: {
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  } = {}): Promise<{ accessToken: string; accessTokenExpiry: Date } | null> {
    await this.ensureInitialized();

    try {
      // Validate refresh token
      const refreshValidation = await this.validateRefreshToken(refreshToken);
      if (!refreshValidation.valid || !refreshValidation.payload) {
        return null;
      }

      const { userId } = refreshValidation.payload;

      // Update refresh token usage
      await this.updateRefreshTokenUsage(refreshToken);

      // Generate new access token
      const { secret, version, algorithm } = jwtSecretManager.getCurrentSecret();
      const now = Math.floor(Date.now() / 1000);
      const accessJti = crypto.randomUUID();

      // Get user email from database (skip in mock mode)
      let userEmail = 'admin@readmyfineprint.com'; // Default for mock mode
      if (!(process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL)) {
        const userResult = await db.query.users.findFirst({
          where: (users: any, { eq }: any) => eq(users.id, userId),
          columns: { email: true }
        });

        if (!userResult) {
          throw new Error('User not found');
        }
        userEmail = userResult.email;
      }

      const accessExp = now + (15 * 60); // 15 minutes

      const accessPayload: AccessTokenPayload = {
        userId,
        email: userEmail,
        tokenType: 'access',
        version,
        jti: accessJti,
        iat: now,
        exp: accessExp
      };

      const accessToken = jwt.sign(accessPayload, secret, {
        algorithm: algorithm as jwt.Algorithm
      });

      const accessExpiry = new Date(accessExp * 1000);

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.LOW,
        message: 'Access token refreshed',
        ip: clientInfo.ip || 'unknown',
        userAgent: clientInfo.userAgent || 'unknown',
        endpoint: 'token-refresh',
        details: {
          userId,
          secretVersion: version,
          accessExpiry: accessExpiry.toISOString()
        }
      });

      return {
        accessToken,
        accessTokenExpiry: accessExpiry
      };

    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.MEDIUM,
        message: 'Failed to refresh access token',
        ip: clientInfo.ip || 'unknown',
        userAgent: clientInfo.userAgent || 'unknown',
        endpoint: 'token-refresh',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return null;
    }
  }

  /**
   * Revoke a token (both access and refresh)
   */
  async revokeToken(token: string, reason: string, revokedBy: string = 'user'): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return false;
      }

      const payload = decoded.payload as any;
      const tokenHash = this.hashToken(token);

      // Add to revocation list (skip in mock mode)
      if (!(process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL)) {
        await db.insert(jwtTokenRevocations).values({
          jti: payload.jti,
          tokenHash,
          userId: payload.userId,
          tokenType: payload.tokenType || 'access',
          reason,
          revokedBy,
          expiresAt: new Date(payload.exp * 1000)
        });

        // If it's a refresh token, also mark it as inactive in refresh tokens table
        if (payload.tokenType === 'refresh') {
          await db.update(refreshTokens)
            .set({ isActive: false })
            .where(eq(refreshTokens.tokenHash, tokenHash));
        }
      }

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.MEDIUM,
        message: `JWT token revoked: ${reason}`,
        ip: 'system',
        userAgent: 'secure-jwt-service',
        endpoint: 'token-revocation',
        details: {
          jti: payload.jti,
          tokenType: payload.tokenType || 'access',
          reason,
          revokedBy
        }
      });

      return true;

    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'Failed to revoke JWT token',
        ip: 'system',
        userAgent: 'secure-jwt-service',
        endpoint: 'token-revocation',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return false;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: string, reason: string, revokedBy: string = 'user'): Promise<number> {
    await this.ensureInitialized();

    try {
      // Skip all database operations in mock mode
      if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
        return 0;
      }

      // Mark all refresh tokens as inactive
      const refreshResult = await db.update(refreshTokens)
        .set({ isActive: false })
        .where(eq(refreshTokens.userId, userId));

      // Get all active refresh tokens to revoke them
      const userRefreshTokens = await db.query.refreshTokens.findMany({
        where: eq(refreshTokens.userId, userId)
      });

      // Add them to revocation list
      const revocations = userRefreshTokens.map((token: any) => ({
        jti: crypto.randomUUID(), // We don't have JTI for refresh tokens in DB, generate one
        tokenHash: token.tokenHash,
        userId,
        tokenType: 'refresh',
        reason,
        revokedBy,
        expiresAt: token.expiresAt
      }));

      if (revocations.length > 0) {
        await db.insert(jwtTokenRevocations).values(revocations);
      }

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.HIGH,
        message: `All JWT tokens revoked for user: ${reason}`,
        ip: 'system',
        userAgent: 'secure-jwt-service',
        endpoint: 'bulk-token-revocation',
        details: {
          userId,
          tokensRevoked: revocations.length,
          reason,
          revokedBy
        }
      });

      return revocations.length;

    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.CRITICAL,
        message: 'Failed to revoke all user tokens',
        ip: 'system',
        userAgent: 'secure-jwt-service',
        endpoint: 'bulk-token-revocation',
        details: { 
          userId,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      });
      throw error;
    }
  }

  /**
   * Clean up expired tokens and revocations
   */
  async cleanupExpiredTokens(): Promise<{ tokensRemoved: number; revocationsRemoved: number }> {
    await this.ensureInitialized();

    try {
      // Skip cleanup in mock mode
      if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
        return { tokensRemoved: 0, revocationsRemoved: 0 };
      }

      const now = new Date();

      // Remove expired refresh tokens
      const expiredTokensResult = await db.delete(refreshTokens)
        .where(lt(refreshTokens.expiresAt, now));

      // Remove expired revocations
      const expiredRevocationsResult = await db.delete(jwtTokenRevocations)
        .where(lt(jwtTokenRevocations.expiresAt, now));

      console.log(`🧹 Cleaned up ${expiredTokensResult.rowCount || 0} expired refresh tokens and ${expiredRevocationsResult.rowCount || 0} expired revocations`);

      return {
        tokensRemoved: expiredTokensResult.rowCount || 0,
        revocationsRemoved: expiredRevocationsResult.rowCount || 0
      };

    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      return { tokensRemoved: 0, revocationsRemoved: 0 };
    }
  }

  // Private helper methods

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async validateRefreshToken(token: string): Promise<TokenValidationResult> {
    try {
      // Decode and verify similar to access token
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return { valid: false, error: 'Invalid token format' };
      }

      const payload = decoded.payload as any;
      const version = payload.version || 1;
      const tokenHash = this.hashToken(token);

      // Check if refresh token exists and is active (skip in mock mode)
      if (!(process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL)) {
        const storedToken = await db.query.refreshTokens.findFirst({
          where: and(
            eq(refreshTokens.tokenHash, tokenHash),
            eq(refreshTokens.isActive, true)
          )
        });

        if (!storedToken) {
          return { valid: false, error: 'Refresh token not found or inactive' };
        }
      }

      // Get secret for this version
      const secretInfo = jwtSecretManager.getSecretByVersion(version);
      if (!secretInfo) {
        return { valid: false, error: 'Secret version not found' };
      }

      // Verify token
      const verifiedPayload = jwt.verify(token, secretInfo.secret, {
        algorithms: [secretInfo.algorithm as jwt.Algorithm]
      }) as RefreshTokenPayload;

      if (verifiedPayload.tokenType !== 'refresh') {
        return { valid: false, error: 'Invalid token type' };
      }

      return { valid: true, payload: verifiedPayload as any };

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, expired: true, error: 'Refresh token expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid refresh token signature' };
      }
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      // Skip revocation check in mock mode
      if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
        return false;
      }

      const revocation = await db.query.jwtTokenRevocations.findFirst({
        where: eq(jwtTokenRevocations.jti, jti)
      });
      return !!revocation;
    } catch (error) {
      // If we can't check revocation status, assume not revoked to avoid false positives
      console.error('Error checking token revocation status:', error);
      return false;
    }
  }

  private async updateRefreshTokenUsage(token: string): Promise<void> {
    try {
      // Skip in mock mode
      if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
        return;
      }

      const tokenHash = this.hashToken(token);
      await db.update(refreshTokens)
        .set({ lastUsed: new Date() })
        .where(eq(refreshTokens.tokenHash, tokenHash));
    } catch (error) {
      console.error('Error updating refresh token usage:', error);
    }
  }

  private async cleanupUserRefreshTokens(userId: string): Promise<void> {
    // Skip cleanup in development/mock mode
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      return;
    }
    
    try {
      // Get all user's refresh tokens, ordered by creation date
      const userTokens = await db.query.refreshTokens.findMany({
        where: eq(refreshTokens.userId, userId),
        orderBy: (refreshTokens: any, { desc }: any) => [desc(refreshTokens.createdAt)]
      });

      // If user has too many tokens, remove the oldest ones
      if (userTokens.length >= this.MAX_REFRESH_TOKENS_PER_USER) {
        const tokensToRemove = userTokens.slice(this.MAX_REFRESH_TOKENS_PER_USER - 1);
        const tokenHashesToRemove = tokensToRemove.map((t: any) => t.tokenHash);

        if (tokenHashesToRemove.length > 0) {
          await db.delete(refreshTokens)
            .where(eq(refreshTokens.tokenHash, tokenHashesToRemove[0])); // Drizzle doesn't support IN with array
        }
      }
    } catch (error) {
      console.error('Error cleaning up user refresh tokens:', error);
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

// Export singleton instance
export const secureJWTService = new SecureJWTService();