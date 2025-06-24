/**
 * Hybrid Token Service
 * Supports both JOSE tokens (new, preferred) and PostgreSQL tokens (legacy, fallback)
 * Provides seamless migration path from PostgreSQL to JOSE tokens
 */

import { joseTokenService } from './jose-token-service';
import { postgresqlTokenStorage } from './postgresql-token-storage';

interface TokenData {
  userId: string;
  subscriptionId?: string | null;
  tierId: string;
  deviceFingerprint?: string;
  expiresAt?: string;
  usageCount?: number;
  lastUsed?: string;
}

interface TokenGenerationParams {
  userId: string;
  subscriptionId?: string;
  tierId: string;
  deviceFingerprint?: string;
}

export class HybridTokenService {
  private useJOSE: boolean;

  constructor() {
    // Enable JOSE by default, fallback to PostgreSQL if JOSE fails
    this.useJOSE = true;
  }

  /**
   * Generate a new subscription token (prefers JOSE, falls back to PostgreSQL)
   */
  async generateSubscriptionToken(params: TokenGenerationParams): Promise<string> {
    console.log(`🔄 Hybrid token generation for user ${params.userId}, JOSE enabled: ${this.useJOSE}`);
    
    try {
      if (this.useJOSE) {
        // Try JOSE first (preferred method)
        console.log(`🎯 Attempting JOSE token generation...`);
        const joseToken = await joseTokenService.generateSubscriptionToken(params);
        console.log(`✅ Generated JOSE subscription token for user ${params.userId}: ${joseToken.slice(0, 30)}...`);
        return joseToken;
      }
    } catch (error) {
      console.warn('⚠️ JOSE token generation failed, falling back to PostgreSQL:', error);
    }

    // Fallback to PostgreSQL storage
    try {
      const postgresToken = await this.generatePostgreSQLToken(params);
      console.log(`✅ Generated PostgreSQL subscription token for user ${params.userId} (fallback)`);
      return postgresToken;
    } catch (error) {
      console.error('❌ Both JOSE and PostgreSQL token generation failed:', error);
      throw error;
    }
  }

  /**
   * Validate a subscription token (supports both JOSE and PostgreSQL tokens)
   */
  async validateSubscriptionToken(token: string): Promise<TokenData | null> {
    if (!token) return null;

    // Detect token type by format
    if (this.isJOSEToken(token)) {
      return await this.validateJOSEToken(token);
    } else if (this.isPostgreSQLToken(token)) {
      return await this.validatePostgreSQLToken(token);
    } else {
      console.warn('🔍 Unknown token format:', token.slice(0, 20) + '...');
      return null;
    }
  }

  /**
   * Update token usage (only applicable to PostgreSQL tokens)
   */
  async updateTokenUsage(token: string): Promise<void> {
    if (this.isPostgreSQLToken(token)) {
      await postgresqlTokenStorage.updateTokenUsage(token);
    }
    // JOSE tokens don't need usage updates (stateless)
  }

  /**
   * Revoke a subscription token (supports both types)
   */
  async revokeToken(token: string, reason: string): Promise<boolean> {
    if (this.isJOSEToken(token)) {
      return await joseTokenService.revokeToken(token, reason);
    } else if (this.isPostgreSQLToken(token)) {
      return await postgresqlTokenStorage.removeToken(token);
    }
    return false;
  }

  /**
   * Revoke all tokens for a user (PostgreSQL only, JOSE tokens expire naturally)
   */
  async revokeAllUserTokens(userId: string, reason: string): Promise<number> {
    // Only PostgreSQL tokens can be bulk revoked
    return await postgresqlTokenStorage.removeAllUserTokens(userId);
  }

  /**
   * Clean up expired tokens (PostgreSQL only, JOSE tokens are self-expiring)
   */
  async cleanupExpired(): Promise<{ tokensRemoved: number }> {
    return await postgresqlTokenStorage.cleanupExpired();
  }

  /**
   * Get token information for debugging/logging
   */
  async getTokenInfo(token: string): Promise<{ type: string; userId?: string; tierId?: string; expired?: boolean } | null> {
    if (this.isJOSEToken(token)) {
      const info = await joseTokenService.extractTokenInfo(token);
      return {
        type: 'JOSE',
        userId: info?.userId,
        tierId: info?.tierId,
        expired: joseTokenService.isTokenExpired(token)
      };
    } else if (this.isPostgreSQLToken(token)) {
      const data = await postgresqlTokenStorage.getToken(token);
      return {
        type: 'PostgreSQL',
        userId: data?.userId,
        tierId: data?.tierId,
        expired: data?.expiresAt ? new Date(data.expiresAt) < new Date() : true
      };
    }
    return null;
  }

  // Private helper methods

  /**
   * Check if token is a JOSE/JWT token
   */
  private isJOSEToken(token: string): boolean {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3 && !token.startsWith('sub_');
  }

  /**
   * Check if token is a PostgreSQL token
   */
  private isPostgreSQLToken(token: string): boolean {
    return token.startsWith('sub_') && token.length > 50; // Legacy format
  }

  /**
   * Validate JOSE token
   */
  private async validateJOSEToken(token: string): Promise<TokenData | null> {
    try {
      const payload = await joseTokenService.validateSubscriptionToken(token);
      if (!payload) return null;

      // Check if token is revoked
      if (await joseTokenService.isTokenRevoked(token)) {
        console.warn('🚫 JOSE token is revoked');
        return null;
      }

      return {
        userId: payload.userId,
        subscriptionId: payload.subscriptionId || null,
        tierId: payload.tierId,
        deviceFingerprint: payload.deviceFingerprint,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
        usageCount: 0, // JOSE tokens don't track usage
        lastUsed: new Date().toISOString()
      };
    } catch (error) {
      console.warn('🔍 JOSE token validation failed:', error);
      return null;
    }
  }

  /**
   * Validate PostgreSQL token
   */
  private async validatePostgreSQLToken(token: string): Promise<TokenData | null> {
    try {
      return await postgresqlTokenStorage.getToken(token);
    } catch (error) {
      console.warn('🔍 PostgreSQL token validation failed:', error);
      return null;
    }
  }

  /**
   * Generate PostgreSQL token (legacy method)
   */
  private async generatePostgreSQLToken(params: TokenGenerationParams): Promise<string> {
    const crypto = await import('crypto');
    const tokenBytes = crypto.randomBytes(48);
    const token = `sub_${tokenBytes.toString('hex')}`;
    
    await postgresqlTokenStorage.storeToken(token, {
      userId: params.userId,
      subscriptionId: params.subscriptionId || null,
      tierId: params.tierId,
      deviceFingerprint: params.deviceFingerprint || 'unknown'
    });
    
    return token;
  }

  /**
   * Get statistics about token usage
   */
  async getTokenStats(): Promise<{
    joseTokensInUse: number;
    postgresqlTokensInDatabase: number;
    recommendMigration: boolean;
  }> {
    // This is a simplified implementation
    // In practice, you'd query actual usage statistics
    
    const postgresqlTokens = await this.getPostgreSQLTokenCount();
    
    return {
      joseTokensInUse: 0, // Hard to count stateless tokens
      postgresqlTokensInDatabase: postgresqlTokens,
      recommendMigration: postgresqlTokens > 0 && this.useJOSE
    };
  }

  /**
   * Get count of PostgreSQL tokens (for migration planning)
   */
  private async getPostgreSQLTokenCount(): Promise<number> {
    try {
      // This would require a count query to the database
      // For now, return 0 as placeholder
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Force disable JOSE (for testing/debugging)
   */
  setJOSEEnabled(enabled: boolean): void {
    this.useJOSE = enabled;
    console.log(`🔧 JOSE tokens ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
export const hybridTokenService = new HybridTokenService();