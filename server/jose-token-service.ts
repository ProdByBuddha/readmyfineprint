/**
 * JOSE-based Token Service
 * Secure, self-contained subscription tokens using JOSE (JSON Web Signature/Encryption)
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import crypto from 'crypto';
import { jwtSecretManager } from './jwt-secret-manager';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

interface SubscriptionTokenPayload extends JWTPayload {
  userId: string;
  subscriptionId?: string;
  tierId: string;
  tier?: string; // Backward compatibility field
  deviceFingerprint?: string;
  tokenType: 'subscription';
}

export class JOSETokenService {
  private secretKey!: Uint8Array;
  private initialized: boolean = false;

  constructor() {
    // Initialize will be called when needed
  }
  
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Use the new JWT secret manager for versioned secrets
      await jwtSecretManager.initialize();
      const { secret } = jwtSecretManager.getCurrentSecret();
      
      // Create a consistent 32-byte key from the versioned secret
      // Use the same salt as auth tokens for consistency
      this.secretKey = crypto.scryptSync(secret, 'auth-salt-v2', 32);
      this.initialized = true;
      
      console.log(`✅ JOSE service initialized with secret version and key length: ${this.secretKey.length} bytes`);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.LOW,
        message: 'JOSE token service initialized with versioned secrets',
        ip: 'system',
        userAgent: 'jose-token-service',
        endpoint: 'initialization'
      });
      
      console.log('✅ JOSE token service initialized with versioned encryption key');
    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.CRITICAL,
        message: 'Failed to initialize JOSE token service',
        ip: 'system',
        userAgent: 'jose-token-service',
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
   * Generate a secure, self-contained subscription token
   */
  async generateSubscriptionToken(params: {
    userId: string;
    subscriptionId?: string;
    tierId: string;
    deviceFingerprint?: string;
  }): Promise<string> {
    await this.ensureInitialized();
    try {
      const payload: SubscriptionTokenPayload = {
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        tierId: params.tierId,
        tier: params.tierId, // Backward compatibility: include both tierId and tier
        deviceFingerprint: params.deviceFingerprint,
        tokenType: 'subscription',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        jti: crypto.randomUUID(), // Unique token ID
      };

      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .setIssuer('readmyfineprint')
        .setAudience('subscription')
        .setJti(payload.jti!) // Add JTI for revocation tracking
        .sign(this.secretKey);

      console.log(`✅ Generated JOSE subscription token for user ${params.userId} (expires in 30 days)`);
      console.log(`🔍 Token generation - using secret key length: ${this.secretKey.length} bytes`);
      console.log(`🔍 Token generation - token prefix: ${token.slice(0, 30)}...`);
      return token;
    } catch (error) {
      console.error('Error generating JOSE subscription token:', error);
      throw error;
    }
  }

  /**
   * Validate and decode a subscription token
   */
  async validateSubscriptionToken(token: string): Promise<SubscriptionTokenPayload | null> {
    await this.ensureInitialized();

    const decodedInfo = await this.extractTokenInfo(token);
    const currentSecret = jwtSecretManager.getCurrentSecret();

    console.log(`🔍 JOSE token validation - token prefix: ${token.slice(0, 30)}...`);
    console.log(`🔍 JOSE token validation - using secret key length: ${this.secretKey.length} bytes`);
    console.log(`🔍 Current JWT secret version: ${currentSecret.version}`);

    try {
      const validationResult = await this.attemptValidateSubscriptionToken(token, decodedInfo);
      const { payload, matchedAudience, legacyMode } = validationResult;

      if (legacyMode === 'fallback-audience' && matchedAudience) {
        console.warn(
          `⚠️ Accepted subscription token with legacy audience "${matchedAudience}". Token regeneration recommended.`
        );
        this.logLegacyCompatibilityEvent({
          mode: legacyMode,
          matchedAudience,
          userId: payload.userId,
          tierId: payload.tierId,
          retry: false
        });
      } else if (legacyMode === 'no-audience') {
        console.warn('⚠️ Accepted subscription token without audience claim (legacy compatibility).');
        this.logLegacyCompatibilityEvent({
          mode: legacyMode,
          userId: payload.userId,
          tierId: payload.tierId,
          retry: false
        });
      } else if (legacyMode === 'unexpected-audience' && matchedAudience) {
        console.warn(
          `⚠️ Accepted subscription token with unexpected audience "${matchedAudience}" (compatibility mode).`
        );
        this.logLegacyCompatibilityEvent({
          mode: legacyMode,
          matchedAudience,
          userId: payload.userId,
          tierId: payload.tierId,
          retry: false
        });
        
      }

      console.log(`✅ Valid JOSE subscription token for user ${payload.userId}, tier: ${payload.tierId}`);
      return payload;
    } catch (error) {
      console.error('❌ JOSE token validation failed:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Token being validated:', token.slice(0, 50) + '...');
      console.error('❌ Secret key details:', {
        length: this.secretKey.length,
        keyPrefix: Buffer.from(this.secretKey.slice(0, 4)).toString('hex')
      });
      console.error('❌ Token audience claim:', this.formatAudienceClaim(decodedInfo?.aud));

      console.log('🔄 Attempting token validation with fresh initialization...');

      try {
        this.initialized = false;
        await this.ensureInitialized();

        const retryResult = await this.attemptValidateSubscriptionToken(token, decodedInfo);
        const { payload, matchedAudience, legacyMode } = retryResult;

        if (legacyMode === 'fallback-audience' && matchedAudience) {
          console.warn(
            `⚠️ Accepted subscription token with legacy audience "${matchedAudience}" after re-initialization.`
          );
          this.logLegacyCompatibilityEvent({
            mode: legacyMode,
            matchedAudience,
            userId: payload.userId,
            tierId: payload.tierId,
            retry: true
          });
        } else if (legacyMode === 'no-audience') {
          console.warn('⚠️ Accepted legacy subscription token without audience claim after re-initialization.');
          this.logLegacyCompatibilityEvent({
            mode: legacyMode,
            userId: payload.userId,
            tierId: payload.tierId,
            retry: true
          });
        } else if (legacyMode === 'unexpected-audience' && matchedAudience) {
          console.warn(
            `⚠️ Accepted subscription token with unexpected audience "${matchedAudience}" after re-initialization.`
          );
          this.logLegacyCompatibilityEvent({
            mode: legacyMode,
            matchedAudience,
            userId: payload.userId,
            tierId: payload.tierId,
            retry: true
          });
        }

        console.log(`✅ JOSE token validation successful after re-initialization for user ${payload.userId}`);
        return payload;
      } catch (retryError) {
        console.error('❌ Token validation failed even after re-initialization:', retryError instanceof Error ? retryError.message : 'Unknown error');
      }

      return null;
    }
  }

  private isAudienceError(error: unknown): error is Error {
    return error instanceof Error && /"aud"|audience/i.test(error.message);
  }

  private formatAudienceClaim(audience: unknown): string {
    if (Array.isArray(audience)) {
      return audience.join(', ');
    }
    return typeof audience === 'string' ? audience : 'missing';
  }

  private logLegacyCompatibilityEvent(params: {
    mode: 'fallback-audience' | 'no-audience' | 'unexpected-audience';
    matchedAudience?: string;
    userId?: string;
    tierId?: string;
    retry: boolean;
  }): void {
    const { mode, matchedAudience, userId, tierId, retry } = params;

    const message =
      mode === 'fallback-audience'
        ? 'Accepted subscription token using legacy audience value'
        : mode === 'no-audience'
          ? 'Accepted subscription token without audience claim'
          : 'Accepted subscription token with unexpected audience value';

    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.SECURITY_VIOLATION,
      severity: SecuritySeverity.MEDIUM,
      message,
      ip: 'system',
      userAgent: 'jose-token-service',
      endpoint: retry ? 'token-validation-retry' : 'token-validation',
      details: {
        mode,
        matchedAudience,
        userId,
        tierId,
        retry
      }
    });
  }

  private async verifySubscriptionToken(
    token: string,
    audience?: string
  ): Promise<SubscriptionTokenPayload> {
    const verificationOptions = audience
      ? { issuer: 'readmyfineprint', audience }
      : { issuer: 'readmyfineprint' };

    const { payload } = await jwtVerify(token, this.secretKey, verificationOptions);
    const subscriptionPayload = payload as SubscriptionTokenPayload;

    if (subscriptionPayload.tokenType !== 'subscription') {
      throw new Error('Invalid subscription token type');
    }

    return subscriptionPayload;
  }

  private async attemptValidateSubscriptionToken(
    token: string,
    decodedInfo?: Partial<SubscriptionTokenPayload> | null
  ): Promise<{
    payload: SubscriptionTokenPayload;
    matchedAudience?: string;
    legacyMode?: 'fallback-audience' | 'no-audience' | 'unexpected-audience';
  }> {
    const primaryAudience = 'subscription';
    const legacyAudiences = ['subscription_token', 'subscription-token', 'subscriptionToken', 'api'];

    try {
      const payload = await this.verifySubscriptionToken(token, primaryAudience);
      return { payload, matchedAudience: primaryAudience };
    } catch (error) {
      if (!this.isAudienceError(error)) {
        throw error;
      }
    }

    let lastAudienceError: Error | null = null;

    for (const legacyAudience of legacyAudiences) {
      try {
        const payload = await this.verifySubscriptionToken(token, legacyAudience);
        
        return { payload, matchedAudience: legacyAudience, legacyMode: 'fallback-audience' };
      } catch (error) {
        if (this.isAudienceError(error)) {
          lastAudienceError = error;
          continue;
        }
        throw error;
      }
    }

    const audienceClaim = decodedInfo?.aud;
    const hasAudienceClaim = typeof audienceClaim !== 'undefined' && !(Array.isArray(audienceClaim) && audienceClaim.length === 0);

    if (!hasAudienceClaim) {
      try {
        const payload = await this.verifySubscriptionToken(token);

        return { payload, legacyMode: 'no-audience' };
      } catch (error) {
        if (this.isAudienceError(error)) {
          lastAudienceError = error;
        } else {
          throw error;
        }
      }
    }

    const formattedAudience = this.formatAudienceClaim(audienceClaim);

    try {
      const payload = await this.verifySubscriptionToken(token);
      return { payload, matchedAudience: formattedAudience, legacyMode: 'unexpected-audience' };
    } catch (error) {
      if (lastAudienceError) {
        throw lastAudienceError;
      }

      throw new Error(`Subscription token validation failed due to unexpected audience claim: ${formattedAudience}`);
    }
  }

  /**
   * Extract token information without full validation (for logging/debugging)
   */
  async extractTokenInfo(token: string): Promise<Partial<SubscriptionTokenPayload> | null> {
    try {
      // Split token and decode payload (without signature verification)
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return payload as Partial<SubscriptionTokenPayload>;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a token is expired without full validation
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp ? payload.exp < now : true;
    } catch (error) {
      return true;
    }
  }

  /**
   * Revoke a token using the secure JWT service
   * @deprecated Use secureJWTService.revokeToken() for persistent revocation
   */
  async revokeToken(token: string, reason: string): Promise<boolean> {
    console.warn('⚠️  JOSETokenService.revokeToken is deprecated. Use secureJWTService.revokeToken() for persistent revocation.');
    
    try {
      // Import secureJWTService dynamically to avoid circular dependencies
      const { secureJWTService } = await import('./secure-jwt-service');
      return await secureJWTService.revokeToken(token, reason, 'jose-service');
    } catch (error) {
      console.error('Error revoking JOSE token via secure service:', error);
      return false;
    }
  }

  /**
   * Check if a token is revoked using the secure JWT service
   * @deprecated Use secureJWTService.validateAccessToken() for comprehensive validation
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      // Import secureJWTService dynamically to avoid circular dependencies
      const { secureJWTService } = await import('./secure-jwt-service');
      const validation = await secureJWTService.validateAccessToken(token);
      return validation.revoked || false;
    } catch (error) {
      // If we can't check, assume not revoked to avoid false positives
      return false;
    }
  }
}

// Export singleton instance
export const joseTokenService = new JOSETokenService();