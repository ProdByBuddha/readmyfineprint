/**
 * Secure JWT Service
 * Implements proper JWT management with refresh tokens, versioned secrets, and persistent revocation
 */


import { jwtVerify } from 'jose';
import crypto from 'crypto';
import { jwtSecretManager } from './jwt-secret-manager';
import { securityLogger, SecurityEventType, SecuritySeverity, getClientInfo } from './security-logger';
// import { ensureDbInitialized } from './db'; // Not needed with original db setup
import { eq, and, lt } from 'drizzle-orm';

// Import database and schema directly
import { db } from './db';
import { jwtTokenRevocations, refreshTokens, jwtSecretVersions } from '@shared/schema';

async function initializeDatabase() {
  // Database is already initialized with the original setup
  // No need for additional initialization
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
    console.warn('⚠️  secureJWTService.generateTokenPair is being replaced with JOSE. Use joseAuthService.generateTokenPair() directly.');
    
    // Delegate to JOSE auth service
    const { joseAuthService } = await import('./jose-auth-service');
    return await joseAuthService.generateTokenPair(userId, email, clientInfo);
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    console.warn('⚠️  secureJWTService.validateAccessToken is being replaced with JOSE. Use joseAuthService.validateAccessToken() directly.');
    
    // Delegate to JOSE auth service
    const { joseAuthService } = await import('./jose-auth-service');
    return await joseAuthService.validateAccessToken(token);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, clientInfo: {
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  } = {}): Promise<{ accessToken: string; accessTokenExpiry: Date } | null> {
    console.warn('⚠️  secureJWTService.refreshAccessToken is being replaced with JOSE. Use joseAuthService.refreshAccessToken() directly.');
    
    // Delegate to JOSE auth service
    const { joseAuthService } = await import('./jose-auth-service');
    return await joseAuthService.refreshAccessToken(refreshToken, clientInfo);
  }

  /**
   * Revoke a token (both access and refresh)
   */
  async revokeToken(token: string, reason: string, revokedBy: string = 'user'): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as any;
      const tokenHash = this.hashToken(token);

      // Add to revocation list (skip only in true mock mode)
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
   * Clean up expired tokens and revocations
   */
  async cleanupExpiredTokens(): Promise<{ tokensRemoved: number; revocationsRemoved: number }> {
    await this.ensureInitialized();

    try {
      // Skip cleanup in mock mode (only if no DATABASE_URL)
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

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async validateRefreshToken(token: string): Promise<{ valid: boolean; payload?: RefreshTokenPayload; expired?: boolean; revoked?: boolean; error?: string; }> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token format' };
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as any;
      const version = payload.version || 1;
      const tokenHash = this.hashToken(token);

      // Check if refresh token exists and is active (skip only in true mock mode)
      if (process.env.DATABASE_URL) {
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

      // Convert secret to Uint8Array for JOSE
      const secretKey = crypto.scryptSync(secretInfo.secret, 'auth-salt-v2', 32);

      // Verify token using JOSE
      const { payload: verifiedPayload } = await jwtVerify(token, secretKey, {
        issuer: 'readmyfineprint',
        audience: 'refresh',
      });

      const refreshPayload = verifiedPayload as unknown as RefreshTokenPayload;

      if (refreshPayload.tokenType !== 'refresh') {
        return { valid: false, error: 'Invalid token type' };
      }

      return { valid: true, payload: refreshPayload };

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          return { valid: false, expired: true, error: 'Refresh token expired' };
        }
        if (error.message.includes('signature')) {
          return { valid: false, error: 'Invalid refresh token signature' };
        }
        if (error.message.includes('aud')) {
          return { valid: false, error: 'Invalid audience' };
        }
      }
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      // Skip revocation check only if we don't have a DATABASE_URL (true mock mode)
      if (!process.env.DATABASE_URL) {
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
      // Skip only in true mock mode
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
    // Skip cleanup only in true mock mode
    if (!process.env.DATABASE_URL) {
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

  /**
   * @deprecated Use joseTokenService for subscription tokens - more secure JOSE implementation
   */
  async generateSubscriptionToken(params: {
    userId: string;
    subscriptionId?: string;
    tierId: string;
    deviceFingerprint?: string;
  }): Promise<string> {
    console.warn('⚠️  secureJWTService.generateSubscriptionToken is deprecated. Use joseTokenService.generateSubscriptionToken() for enhanced security.');
    
    // Delegate to JOSE service
    const { joseTokenService } = await import('./jose-token-service');
    return await joseTokenService.generateSubscriptionToken(params);
  }

  /**
   * @deprecated Use joseTokenService for subscription tokens - more secure JOSE implementation
   */
  async validateSubscriptionToken(token: string): Promise<{
    userId: string;
    subscriptionId?: string;
    tierId: string;
    deviceFingerprint?: string;
  } | null> {
    console.warn('⚠️  secureJWTService.validateSubscriptionToken is deprecated. Use joseTokenService.validateSubscriptionToken() for enhanced security.');
    
    // Delegate to JOSE service
    const { joseTokenService } = await import('./jose-token-service');
    const result = await joseTokenService.validateSubscriptionToken(token);
    
    // Convert JOSE result to expected format
    if (!result) return null;
    
    return {
      userId: result.userId,
      subscriptionId: result.subscriptionId,
      tierId: result.tierId,
      deviceFingerprint: result.deviceFingerprint
    };
  }
}

// Export singleton instance
export const secureJWTService = new SecureJWTService();