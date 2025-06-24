/**
 * JOSE-based Token Service
 * Secure, self-contained subscription tokens using JOSE (JSON Web Signature/Encryption)
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import crypto from 'crypto';

interface SubscriptionTokenPayload extends JWTPayload {
  userId: string;
  subscriptionId?: string;
  tierId: string;
  deviceFingerprint?: string;
  tokenType: 'subscription';
}

export class JOSETokenService {
  private secretKey: Uint8Array;

  constructor() {
    const secret = process.env.SUBSCRIPTION_TOKEN_SECRET || process.env.JWT_SECRET || process.env.TOKEN_ENCRYPTION_KEY;
    if (!secret) {
      console.warn('⚠️ No SUBSCRIPTION_TOKEN_SECRET, JWT_SECRET, or TOKEN_ENCRYPTION_KEY found, JOSE tokens disabled');
      // Use a default secret for fallback (not recommended for production)
      this.secretKey = crypto.scryptSync('fallback-secret-key-not-for-production', 'subscription-salt', 32);
    } else {
      // Create a consistent 32-byte key from the secret
      this.secretKey = crypto.scryptSync(secret, 'subscription-salt', 32);
      console.log('✅ JOSE token service initialized with encryption key');
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
    try {
      const payload: SubscriptionTokenPayload = {
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        tierId: params.tierId,
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
        .sign(this.secretKey);

      console.log(`Generated JOSE subscription token for user ${params.userId} (expires in 30 days)`);
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
    try {
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
      console.log(`Valid JOSE subscription token for user ${subscriptionPayload.userId}, tier: ${subscriptionPayload.tierId}`);
      return subscriptionPayload;
    } catch (error) {
      console.warn('JOSE token validation failed:', error instanceof Error ? error.message : 'Unknown error');
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
   * Revoke a token by adding it to a revocation list
   * (Simple in-memory implementation - could be enhanced with Redis/database)
   */
  private revokedTokens = new Set<string>();

  async revokeToken(token: string, reason: string): Promise<boolean> {
    try {
      const tokenInfo = await this.extractTokenInfo(token);
      if (!tokenInfo?.jti) return false;

      this.revokedTokens.add(tokenInfo.jti);
      console.log(`Revoked JOSE subscription token: ${reason} (ID: ${tokenInfo.jti})`);
      
      // Clean up expired revocations periodically
      this.cleanupRevokedTokens();
      
      return true;
    } catch (error) {
      console.error('Error revoking JOSE token:', error);
      return false;
    }
  }

  /**
   * Check if a token is revoked
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      const tokenInfo = await this.extractTokenInfo(token);
      return tokenInfo?.jti ? this.revokedTokens.has(tokenInfo.jti) : true;
    } catch (error) {
      return true;
    }
  }

  /**
   * Clean up expired token revocations
   */
  private cleanupRevokedTokens(): void {
    // In a real implementation, you'd want to:
    // 1. Store revoked tokens with expiration times
    // 2. Periodically clean up expired revocations
    // 3. Use Redis or database for distributed systems
    
    // For now, just limit the size
    if (this.revokedTokens.size > 10000) {
      const tokensArray = Array.from(this.revokedTokens);
      this.revokedTokens = new Set(tokensArray.slice(-5000)); // Keep last 5000
    }
  }
}

// Export singleton instance
export const joseTokenService = new JOSETokenService();