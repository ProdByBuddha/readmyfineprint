/**
 * JWT Secret Manager
 * Implements versioned JWT secret management with proper rotation and security
 */

import crypto from 'crypto';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

interface SecretVersion {
  version: number;
  secret: string;
  algorithm: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

interface SecretConfig {
  algorithm: 'HS256' | 'HS384' | 'HS512';
  keyLength: number;
  rotationIntervalDays: number;
  maxVersionsToKeep: number;
}

export class JWTSecretManager {
  private secrets: Map<number, SecretVersion> = new Map();
  private currentVersion: number = 1;
  private config: SecretConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<SecretConfig>) {
    this.config = {
      algorithm: 'HS256',
      keyLength: 64, // 512 bits for enhanced security
      rotationIntervalDays: 30, // Rotate every 30 days
      maxVersionsToKeep: 3,
      ...config
    };
  }

  /**
   * Initialize the secret manager with environment variables
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check for existing secrets in environment
      const primarySecret = this.getSecretFromEnv();
      if (!primarySecret) {
        throw new Error('CRITICAL SECURITY ERROR: No JWT secret found in environment variables');
      }

      // Validate secret strength
      this.validateSecretStrength(primarySecret);

      // Initialize with current secret
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (this.config.rotationIntervalDays * 24 * 60 * 60 * 1000));

      this.secrets.set(this.currentVersion, {
        version: this.currentVersion,
        secret: primarySecret,
        algorithm: this.config.algorithm,
        createdAt: now,
        expiresAt,
        isActive: true
      });

      this.initialized = true;
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.LOW,
        message: 'JWT Secret Manager initialized successfully',
        ip: 'system',
        userAgent: 'jwt-secret-manager',
        endpoint: 'initialization'
      });

      console.log('✅ JWT Secret Manager initialized with versioned secrets');
    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.CRITICAL,
        message: 'Failed to initialize JWT Secret Manager',
        ip: 'system',
        userAgent: 'jwt-secret-manager',
        endpoint: 'initialization',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Get the current active secret for signing new tokens
   */
  getCurrentSecret(): { secret: string; version: number; algorithm: string } {
    if (!this.initialized) {
      throw new Error('JWT Secret Manager not initialized');
    }

    const currentSecret = this.secrets.get(this.currentVersion);
    if (!currentSecret || !currentSecret.isActive) {
      throw new Error('No active JWT secret available');
    }

    // Check if secret needs rotation
    if (this.shouldRotateSecret(currentSecret)) {
      console.warn('⚠️ JWT secret should be rotated - current secret expires soon');
    }

    return {
      secret: currentSecret.secret,
      version: currentSecret.version,
      algorithm: currentSecret.algorithm
    };
  }

  /**
   * Get secret by version for verifying existing tokens
   */
  getSecretByVersion(version: number): { secret: string; algorithm: string } | null {
    if (!this.initialized) {
      throw new Error('JWT Secret Manager not initialized');
    }

    const secret = this.secrets.get(version);
    if (!secret) {
      return null;
    }

    return {
      secret: secret.secret,
      algorithm: secret.algorithm
    };
  }

  /**
   * Rotate to a new secret version
   */
  async rotateSecret(): Promise<{ oldVersion: number; newVersion: number }> {
    if (!this.initialized) {
      throw new Error('JWT Secret Manager not initialized');
    }

    const oldVersion = this.currentVersion;
    const newVersion = this.currentVersion + 1;

    try {
      // Generate new secret
      const newSecret = this.generateSecureSecret();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (this.config.rotationIntervalDays * 24 * 60 * 60 * 1000));

      // Deactivate old secret but keep it for verification
      const oldSecret = this.secrets.get(oldVersion);
      if (oldSecret) {
        oldSecret.isActive = false;
      }

      // Add new secret
      this.secrets.set(newVersion, {
        version: newVersion,
        secret: newSecret,
        algorithm: this.config.algorithm,
        createdAt: now,
        expiresAt,
        isActive: true
      });

      this.currentVersion = newVersion;

      // Clean up old secrets
      this.cleanupOldSecrets();

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.MEDIUM,
        message: 'JWT secret rotated successfully',
        ip: 'system',
        userAgent: 'jwt-secret-manager',
        endpoint: 'secret-rotation',
        details: {
          oldVersion,
          newVersion,
          totalVersions: this.secrets.size
        }
      });

      console.log(`🔄 JWT secret rotated from version ${oldVersion} to ${newVersion}`);
      return { oldVersion, newVersion };

    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.CRITICAL,
        message: 'Failed to rotate JWT secret',
        ip: 'system',
        userAgent: 'jwt-secret-manager',
        endpoint: 'secret-rotation',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Check if secret should be rotated based on expiration
   */
  shouldRotateSecret(secret?: SecretVersion): boolean {
    const currentSecret = secret || this.secrets.get(this.currentVersion);
    if (!currentSecret) return true;

    const now = new Date();
    const rotationThreshold = new Date(currentSecret.expiresAt.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days before expiry

    return now >= rotationThreshold;
  }

  /**
   * Get all valid secret versions (for listing/monitoring)
   */
  getSecretVersions(): Array<{
    version: number;
    algorithm: string;
    createdAt: Date;
    expiresAt: Date;
    isActive: boolean;
  }> {
    return Array.from(this.secrets.values()).map(secret => ({
      version: secret.version,
      algorithm: secret.algorithm,
      createdAt: secret.createdAt,
      expiresAt: secret.expiresAt,
      isActive: secret.isActive
    }));
  }

  /**
   * Force expiration of a specific secret version
   */
  expireSecretVersion(version: number, reason: string): boolean {
    const secret = this.secrets.get(version);
    if (!secret) return false;

    secret.isActive = false;
    secret.expiresAt = new Date(); // Immediate expiration

    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.SYSTEM,
      severity: SecuritySeverity.HIGH,
      message: `JWT secret version ${version} forcibly expired`,
      ip: 'system',
      userAgent: 'jwt-secret-manager',
      endpoint: 'secret-expiration',
      details: { version, reason }
    });

    return true;
  }

  // Private helper methods

  private getSecretFromEnv(): string | null {
    // Try multiple environment variables in order of preference
    const candidates = [
      process.env.JWT_SECRET_V2, // New versioned secret
      process.env.JWT_SECRET,
      process.env.SESSION_SECRET,
      process.env.TOKEN_ENCRYPTION_KEY
    ];

    for (const secret of candidates) {
      if (secret && secret.length >= 32) {
        return secret;
      }
    }

    return null;
  }

  private validateSecretStrength(secret: string): void {
    if (secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }

    if (secret.length < 64) {
      console.warn('⚠️ JWT secret is less than 64 characters - consider using a longer secret for enhanced security');
    }

    // Check for common weak patterns
    if (/^(.)\1*$/.test(secret)) {
      throw new Error('JWT secret cannot be a repeated character');
    }

    if (secret.toLowerCase().includes('password') || secret.toLowerCase().includes('secret')) {
      throw new Error('JWT secret should not contain common words like "password" or "secret"');
    }
  }

  private generateSecureSecret(): string {
    return crypto.randomBytes(this.config.keyLength).toString('hex');
  }

  private cleanupOldSecrets(): void {
    const sortedVersions = Array.from(this.secrets.keys()).sort((a, b) => b - a);
    
    // Keep only the most recent versions
    const versionsToDelete = sortedVersions.slice(this.config.maxVersionsToKeep);
    
    for (const version of versionsToDelete) {
      this.secrets.delete(version);
    }

    if (versionsToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${versionsToDelete.length} old JWT secret versions`);
    }
  }
}

// Export singleton instance
export const jwtSecretManager = new JWTSecretManager();