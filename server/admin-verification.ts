import crypto from 'crypto';
import { emailService } from './email-service';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';
import { databaseStorage } from './storage';

interface VerificationCode {
  code: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

interface AdminToken {
  token: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

class AdminVerificationService {
  private static instance: AdminVerificationService;
  private verificationCodes = new Map<string, VerificationCode>();
  private adminTokens = new Map<string, AdminToken>();
  private readonly CODE_EXPIRY_MINUTES = 10;
  private readonly TOKEN_EXPIRY_HOURS = 24; // Admin tokens expire after 24 hours
  private readonly CODE_LENGTH = 6;

  private constructor() {}

  public static getInstance(): AdminVerificationService {
    if (!AdminVerificationService.instance) {
      AdminVerificationService.instance = new AdminVerificationService();
    }
    return AdminVerificationService.instance;
  }

  /**
   * Generate a secure 6-digit verification code
   */
  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send verification code to admin emails
   */
  async sendAdminVerificationCode(requestIp: string, userAgent: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check for rate limiting - max 5 codes per hour (increased for automatic sending)
      const recentCodes = Array.from(this.verificationCodes.values())
        .filter(code => code.createdAt.getTime() > Date.now() - (60 * 60 * 1000));

      if (recentCodes.length >= 5) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.RATE_LIMIT,
          severity: SecuritySeverity.MEDIUM,
          message: 'Admin verification code rate limit exceeded',
          ip: requestIp,
          userAgent,
          endpoint: '/api/admin/request-verification'
        });
        return { success: false, message: 'Rate limit exceeded. Please wait before requesting another code.' };
      }

      const code = this.generateCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.CODE_EXPIRY_MINUTES * 60 * 1000);

      // Store the verification code
      this.verificationCodes.set(code, {
        code,
        email: 'admin@readmyfineprint.com',
        createdAt: now,
        expiresAt,
        used: false
      });

      // Send to both admin emails
      const adminEmail = ['admin@readmyfineprint.com'];

      // Log the verification request
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.MEDIUM,
        message: 'Admin verification code sent',
        ip: requestIp,
        userAgent,
        endpoint: '/api/admin/request-verification',
        details: { emails: adminEmail, expiresAt: expiresAt.toISOString() }
      });

      // Clean up expired codes
      this.cleanupExpiredCodes();

      return { 
        success: true, 
        message: `Verification code sent to admin emails. Code expires in ${this.CODE_EXPIRY_MINUTES} minutes.` 
      };

    } catch (error) {
      console.error('Error sending admin verification code:', error);
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'Failed to send admin verification code',
        ip: requestIp,
        userAgent,
        endpoint: '/api/admin/request-verification',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return { success: false, message: 'Failed to send verification code. Please try again.' };
    }
  }

  /**
   * Verify admin code
   */
  async verifyAdminCode(code: string, requestIp: string, userAgent: string): Promise<{ success: boolean; message: string; token?: string; userId?: string; email?: string }> {
    try {
      const verification = this.verificationCodes.get(code);

      if (!verification) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.HIGH,
          message: 'Invalid admin verification code attempted',
          ip: requestIp,
          userAgent,
          endpoint: '/api/admin/verify-code',
          details: { attemptedCode: code.substring(0, 2) + '****' }
        });
        return { success: false, message: 'Invalid verification code' };
      }

      if (verification.used) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.HIGH,
          message: 'Already used admin verification code attempted',
          ip: requestIp,
          userAgent,
          endpoint: '/api/admin/verify-code'
        });
        return { success: false, message: 'Verification code has already been used' };
      }

      if (Date.now() > verification.expiresAt.getTime()) {
        this.verificationCodes.delete(code);
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.MEDIUM,
          message: 'Expired admin verification code attempted',
          ip: requestIp,
          userAgent,
          endpoint: '/api/admin/verify-code'
        });
        return { success: false, message: 'Verification code has expired' };
      }

      // Mark as used
      verification.used = true;

      // Generate secure admin session token
      const adminToken = crypto.randomBytes(32).toString('hex');
      const now = new Date();
      const tokenExpiresAt = new Date(now.getTime() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Store the admin token with metadata
      this.adminTokens.set(adminToken, {
        token: adminToken,
        email: verification.email,
        createdAt: now,
        expiresAt: tokenExpiresAt,
        ipAddress: requestIp,
        userAgent
      });

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.MEDIUM,
        message: 'Admin verification successful - token issued',
        ip: requestIp,
        userAgent,
        endpoint: '/api/admin/verify-code',
        details: { 
          adminEmail: verification.email,
          tokenExpiresAt: tokenExpiresAt.toISOString()
        }
      });

      // Clean up expired codes and tokens
      this.cleanupExpiredCodes();
      this.cleanupExpiredTokens();

      // Fetch the admin user from the database to get their ID
      const adminUser = await databaseStorage.getUserByEmail(verification.email);

      if (!adminUser) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.ERROR,
          severity: SecuritySeverity.CRITICAL,
          message: 'Admin user not found in database after verification',
          ip: requestIp,
          userAgent,
          endpoint: '/api/admin/verify-code',
          details: { adminEmail: verification.email }
        });
        return { success: false, message: 'Admin user not found' };
      }

      return { 
        success: true, 
        message: 'Admin access granted', 
        token: adminToken,
        userId: adminUser.id,
        email: adminUser.email
      };

    } catch (error) {
      console.error('Error verifying admin code:', error);
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'Error during admin code verification',
        ip: requestIp,
        userAgent,
        endpoint: '/api/admin/verify-code',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return { success: false, message: 'Verification failed. Please try again.' };
    }
  }

  /**
   * Validate admin token
   */
  validateAdminToken(token: string, requestIp: string, userAgent: string): { valid: boolean; email?: string; message?: string } {
    this.cleanupExpiredTokens();

    const adminToken = this.adminTokens.get(token);

    if (!adminToken) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.HIGH,
        message: 'Invalid admin token attempted',
        ip: requestIp,
        userAgent,
        endpoint: 'admin-token-validation',
        details: { 
          tokenPrefix: token.substring(0, 8) + '...', 
          reason: 'Token not found'
        }
      });
      return { valid: false, message: 'Invalid admin token' };
    }

    if (Date.now() > adminToken.expiresAt.getTime()) {
      this.adminTokens.delete(token);
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.MEDIUM,
        message: 'Expired admin token attempted',
        ip: requestIp,
        userAgent,
        endpoint: 'admin-token-validation',
        details: { adminEmail: adminToken.email }
      });
      return { valid: false, message: 'Admin token has expired' };
    }

    // Optional: Add IP/User-Agent validation for extra security
    // Uncomment if you want stricter validation:
    // if (adminToken.ipAddress !== requestIp || adminToken.userAgent !== userAgent) {
    //   securityLogger.logSecurityEvent({
    //     eventType: SecurityEventType.AUTHENTICATION,
    //     severity: SecuritySeverity.HIGH,
    //     message: 'Admin token used from different location',
    //     ip: requestIp,
    //     userAgent,
    //     endpoint: 'admin-token-validation',
    //     details: { 
    //       originalIp: adminToken.ipAddress,
    //       originalUserAgent: adminToken.userAgent,
    //       adminEmail: adminToken.email
    //     }
    //   });
    //   return { valid: false, message: 'Token validation failed' };
    // }

    return { valid: true, email: adminToken.email };
  }

  /**
   * Revoke admin token
   */
  revokeAdminToken(token: string): boolean {
    const deleted = this.adminTokens.delete(token);
    if (deleted) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.LOW,
        message: 'Admin token revoked',
        ip: 'system',
        userAgent: 'admin-verification-service',
        endpoint: 'admin-token-revocation'
      });
    }
    return deleted;
  }

  /**
   * Clean up expired verification codes
   */
  private cleanupExpiredCodes(): void {
    const now = Date.now();
    for (const [code, verification] of this.verificationCodes) {
      if (now > verification.expiresAt.getTime()) {
        this.verificationCodes.delete(code);
      }
    }
  }

  /**
   * Clean up expired admin tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, adminToken] of this.adminTokens) {
      if (now > adminToken.expiresAt.getTime()) {
        this.adminTokens.delete(token);
      }
    }
  }

  /**
   * Get active verification stats (for monitoring)
   */
  getVerificationStats(): { 
    codes: { active: number; used: number; expired: number };
    tokens: { active: number; expired: number };
  } {
    this.cleanupExpiredCodes();
    this.cleanupExpiredTokens();

    const codes = Array.from(this.verificationCodes.values());
    const tokens = Array.from(this.adminTokens.values());

    return {
      codes: {
        active: codes.filter(c => !c.used).length,
        used: codes.filter(c => c.used).length,
        expired: 0 // Already cleaned up
      },
      tokens: {
        active: tokens.length,
        expired: 0 // Already cleaned up
      }
    };
  }
}

export const adminVerificationService = AdminVerificationService.getInstance();