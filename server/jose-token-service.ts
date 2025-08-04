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
    try {
      console.log(`🔍 JOSE token validation - token prefix: ${token.slice(0, 30)}...`);
      console.log(`🔍 JOSE token validation - using secret key length: ${this.secretKey.length} bytes`);
      
      // Get current secret info for debugging
      const currentSecret = jwtSecretManager.getCurrentSecret();
      console.log(`🔍 Current JWT secret version: ${currentSecret.version}`);
      
      const { payload } = await jwtVerify(token, this.secretKey, {
        issuer: 'readmyfineprint',
        audience: 'subscription',
      });

      const subscriptionPayload = payload as SubscriptionTokenPayload;

      // Verify it's a subscription token
      if (subscriptionPayload.tokenType !== 'subscription') {
        console.warn('Invalid token type');
        return null;
      }

      // Additional validation can go here
      console.log(`✅ Valid JOSE subscription token for user ${subscriptionPayload.userId}, tier: ${subscriptionPayload.tierId}`);
      return subscriptionPayload;
    } catch (error) {
      console.error('❌ JOSE token validation failed:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Token being validated:', token.slice(0, 50) + '...');
      console.error('❌ Secret key details:', {
        length: this.secretKey.length,
        keyPrefix: Buffer.from(this.secretKey.slice(0, 4)).toString('hex')
      });
      
      // Try to re-initialize and validate again as a fallback
      console.log('🔄 Attempting token validation with fresh initialization...');
      try {
        this.initialized = false;
        await this.ensureInitialized();
        
        const { payload } = await jwtVerify(token, this.secretKey, {
          issuer: 'readmyfineprint',
          audience: 'subscription',
        });
        
        const subscriptionPayload = payload as SubscriptionTokenPayload;
        if (subscriptionPayload.tokenType === 'subscription') {
          console.log(`✅ JOSE token validation successful after re-initialization for user ${subscriptionPayload.userId}`);
          return subscriptionPayload;
        }
      } catch (retryError) {
        console.error('❌ Token validation failed even after re-initialization:', retryError instanceof Error ? retryError.message : 'Unknown error');
      }
      
      return null;
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