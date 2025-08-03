/**
 * JOSE-based Authentication Token Service
 * Handles access and refresh tokens using JOSE for consistent security
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import crypto from 'crypto';
import { jwtSecretManager } from './jwt-secret-manager';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';
import { db } from './db';
import { jwtTokenRevocations, refreshTokens } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';

interface AccessTokenPayload extends JWTPayload {
  userId: string;
  email: string;
  tokenType: 'access';
  version: number;
  jti: string;
  iat: number;
  exp: number;
}

interface RefreshTokenPayload extends JWTPayload {
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

export class JOSEAuthService {
  private secretKey!: Uint8Array;
  private initialized: boolean = false;
  private readonly ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly MAX_REFRESH_TOKENS_PER_USER = 5;

  constructor() {
    // Initialize will be called when needed
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await jwtSecretManager.initialize();
      const { secret } = jwtSecretManager.getCurrentSecret();

      // Create a consistent 32-byte key for JOSE operations
      // Use same salt as subscription tokens for consistency
      this.secretKey = crypto.scryptSync(secret, 'auth-salt-v2', 32);
      this.initialized = true;

      console.log(`✅ JOSE Auth Service initialized with key length: ${this.secretKey.length} bytes`);

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.LOW,
        message: 'JOSE Auth Service initialized',
        ip: 'system',
        userAgent: 'jose-auth-service',
        endpoint: 'initialization'
      });
    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.CRITICAL,
        message: 'Failed to initialize JOSE Auth Service',
        ip: 'system',
        userAgent: 'jose-auth-service',
        endpoint: 'initialization',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate access and refresh token pair using JOSE
   */
  async generateTokenPair(userId: string, email: string, clientInfo: {
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  } = {}): Promise<TokenPair> {
    await this.ensureInitialized();

    try {
      const now = Math.floor(Date.now() / 1000);
      const { version } = jwtSecretManager.getCurrentSecret();

      // Generate unique JTIs
      const accessJti = crypto.randomUUID();
      const refreshJti = crypto.randomUUID();

      // Calculate expiration times
      const accessExp = now + this.ACCESS_TOKEN_EXPIRY;
      const refreshExp = now + this.REFRESH_TOKEN_EXPIRY;

      // Create access token payload
      const accessPayload: AccessTokenPayload = {
        userId,
        email,
        tokenType: 'access',
        version,
        iat: now,
        exp: accessExp,
        jti: accessJti,
        iss: 'readmyfineprint',
        aud: 'api'
      };

      // Create refresh token payload
      const refreshPayload: RefreshTokenPayload = {
        userId,
        tokenType: 'refresh',
        version,
        iat: now,
        exp: refreshExp,
        jti: refreshJti,
        iss: 'readmyfineprint',
        aud: 'refresh'
      };

      // Sign tokens using JOSE
      const accessToken = await new SignJWT(accessPayload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .sign(this.secretKey);

      const refreshToken = await new SignJWT(refreshPayload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .sign(this.secretKey);

      // Store refresh token in database
      const refreshExpiry = new Date(refreshExp * 1000);
      const accessExpiry = new Date(accessExp * 1000);

      if (process.env.DATABASE_URL) {
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

      console.log(`✅ Generated JOSE token pair for user ${userId} (access: 15min, refresh: 7d)`);

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.LOW,
        message: 'JOSE token pair generated',
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
        message: 'Failed to generate JOSE token pair',
        ip: clientInfo.ip || 'unknown',
        userAgent: clientInfo.userAgent || 'unknown',
        endpoint: 'token-generation',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Validate access token using JOSE
   */
  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    await this.ensureInitialized();

    try {
      // Verify token using JOSE
      const { payload } = await jwtVerify(token, this.secretKey, {
        issuer: 'readmyfineprint',
        audience: 'api',
      });

      const accessPayload = payload as AccessTokenPayload;

      // Verify token type
      if (accessPayload.tokenType !== 'access') {
        return { valid: false, error: 'Invalid token type' };
      }

      // Check if token is revoked
      if (await this.isTokenRevoked(accessPayload.jti!)) {
        return { valid: false, revoked: true, error: 'Token has been revoked' };
      }

      console.log(`✅ Valid JOSE access token for user ${accessPayload.userId}`);
      return { valid: true, payload: accessPayload };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('exp')) {
          return { valid: false, expired: true, error: 'Token expired' };
        }
        if (error.message.includes('signature')) {
          return { valid: false, error: 'Invalid token signature' };
        }
      }
      console.error('❌ JOSE access token validation failed:', error);
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

      // Get user email from database
      let userEmail = 'unknown@readmyfineprint.com';
      if (process.env.DATABASE_URL) {
        const { users } = await import('@shared/schema');
        const userResult = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { email: true }
        });

        if (!userResult) {
          throw new Error('User not found');
        }
        userEmail = userResult.email;
      }

      // Generate new access token
      const now = Math.floor(Date.now() / 1000);
      const { version } = jwtSecretManager.getCurrentSecret();
      const accessJti = crypto.randomUUID();
      const accessExp = now + this.ACCESS_TOKEN_EXPIRY;

      const accessPayload: AccessTokenPayload = {
        userId,
        email: userEmail,
        tokenType: 'access',
        version,
        iat: now,
        exp: accessExp,
        jti: accessJti,
        iss: 'readmyfineprint',
        aud: 'api'
      };

      const accessToken = await new SignJWT(accessPayload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .sign(this.secretKey);

      const accessExpiry = new Date(accessExp * 1000);

      console.log(`✅ Refreshed JOSE access token for user ${userId}`);

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
   * Revoke a token
   */
  async revokeToken(token: string, reason: string, revokedBy: string = 'user'): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Extract token info without full validation
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as any;
      const tokenHash = this.hashToken(token);

      // Add to revocation list
      if (process.env.DATABASE_URL) {
        await db.insert(jwtTokenRevocations).values({
          jti: payload.jti,
          tokenHash,
          userId: payload.userId,
          tokenType: payload.tokenType || 'access',
          reason,
          revokedBy,
          expiresAt: new Date(payload.exp * 1000)
        }).onConflictDoNothing();

        // If it's a refresh token, also mark it as inactive
        if (payload.tokenType === 'refresh') {
          await db.update(refreshTokens)
            .set({ isActive: false })
            .where(eq(refreshTokens.tokenHash, tokenHash));
        }
      }

      console.log(`✅ Revoked JOSE token: ${payload.jti} (${payload.tokenType})`);

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.MEDIUM,
        message: `JWT token revoked: ${reason}`,
        ip: 'system',
        userAgent: 'jose-auth-service',
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
      console.error('Error revoking JOSE token:', error);
      return false;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<{ tokensRemoved: number; revocationsRemoved: number }> {
    await this.ensureInitialized();

    try {
      if (!process.env.DATABASE_URL) {
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

  private async validateRefreshToken(token: string): Promise<{ valid: boolean; payload?: RefreshTokenPayload }> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        issuer: 'readmyfineprint',
        audience: 'refresh',
      });

      const refreshPayload = payload as RefreshTokenPayload;

      if (refreshPayload.tokenType !== 'refresh') {
        return { valid: false };
      }

      // Check if refresh token exists and is active
      if (process.env.DATABASE_URL) {
        const tokenHash = this.hashToken(token);
        const storedToken = await db.query.refreshTokens.findFirst({
          where: and(
            eq(refreshTokens.tokenHash, tokenHash),
            eq(refreshTokens.isActive, true)
          )
        });

        if (!storedToken) {
          return { valid: false };
        }
      }

      return { valid: true, payload: refreshPayload };
    } catch (error) {
      console.error('Refresh token validation error:', error);
      return { valid: false };
    }
  }

  private async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      if (!process.env.DATABASE_URL) {
        return false;
      }

      const revocation = await db.query.jwtTokenRevocations.findFirst({
        where: eq(jwtTokenRevocations.jti, jti)
      });
      return !!revocation;
    } catch (error) {
      console.error('Error checking token revocation status:', error);
      return false;
    }
  }

  private async updateRefreshTokenUsage(token: string): Promise<void> {
    try {
      if (!process.env.DATABASE_URL) {
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
    if (!process.env.DATABASE_URL) {
      return;
    }

    try {
      const userTokens = await db.query.refreshTokens.findMany({
        where: eq(refreshTokens.userId, userId),
        orderBy: (refreshTokens: any, { desc }: any) => [desc(refreshTokens.createdAt)]
      });

      if (userTokens.length >= this.MAX_REFRESH_TOKENS_PER_USER) {
        const tokensToRemove = userTokens.slice(this.MAX_REFRESH_TOKENS_PER_USER - 1);
        for (const token of tokensToRemove) {
          await db.delete(refreshTokens)
            .where(eq(refreshTokens.id, token.id));
        }
      }
    } catch (error) {
      console.error('Error cleaning up user refresh tokens:', error);
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: string, reason: string, revokedBy: string = 'user'): Promise<number> {
    await this.ensureInitialized();

    try {
      // Skip all database operations in mock mode (only if no DATABASE_URL)
      if (!process.env.DATABASE_URL) {
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
        // Use onConflictDoNothing to handle duplicate token revocations gracefully
        await db.insert(jwtTokenRevocations).values(revocations).onConflictDoNothing();
      }

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.HIGH,
        message: `All JWT tokens revoked for user: ${reason}`,
        ip: 'system',
        userAgent: 'jose-auth-service',
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
        userAgent: 'jose-auth-service',
        endpoint: 'bulk-token-revocation',
        details: { 
          userId,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      });
      throw error;
    }
  }
}

// Export singleton instance
export const joseAuthService = new JOSEAuthService();