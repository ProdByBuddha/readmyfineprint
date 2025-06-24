import crypto from 'crypto';
import { emailService } from './email-service';
import { securityLogger } from './security-logger';

interface VerificationCode {
  code: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

class AdminVerificationService {
  private static instance: AdminVerificationService;
  private verificationCodes = new Map<string, VerificationCode>();
  private readonly CODE_EXPIRY_MINUTES = 10;
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
      // Check for rate limiting - max 3 codes per hour
      const recentCodes = Array.from(this.verificationCodes.values())
        .filter(code => code.createdAt.getTime() > Date.now() - (60 * 60 * 1000));
      
      if (recentCodes.length >= 3) {
        securityLogger.logSecurityEvent({
          eventType: 'RATE_LIMIT',
          severity: 'MEDIUM',
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
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
      
      const emailPromises = adminEmails.map(email => 
        emailService.sendEmail({
          to: email,
          subject: 'ReadMyFinePrint Admin Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1f2937; text-align: center;">Admin Access Verification</h2>
              
              <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3 style="margin: 0; color: #374151;">Your Verification Code</h3>
                <div style="font-size: 32px; font-weight: bold; color: #059669; margin: 15px 0; letter-spacing: 3px;">
                  ${code}
                </div>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  This code expires in ${this.CODE_EXPIRY_MINUTES} minutes
                </p>
              </div>

              <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">
                  <strong>Security Notice:</strong> This code provides admin access to ReadMyFinePrint. 
                  Only use this code if you requested admin access.
                </p>
              </div>

              <div style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <p>Request from: ${requestIp}</p>
                <p>Time: ${now.toLocaleString()}</p>
                <p>If you did not request this code, please ignore this email.</p>
              </div>
            </div>
          `
        })
      );

      await Promise.all(emailPromises);

      // Log the verification request
      securityLogger.logSecurityEvent({
        eventType: 'AUTHENTICATION',
        severity: 'MEDIUM',
        message: 'Admin verification code sent',
        ip: requestIp,
        userAgent,
        endpoint: '/api/admin/request-verification',
        details: { emails: adminEmails, expiresAt: expiresAt.toISOString() }
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
        eventType: 'ERROR',
        severity: 'HIGH',
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
  async verifyAdminCode(code: string, requestIp: string, userAgent: string): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      const verification = this.verificationCodes.get(code);

      if (!verification) {
        securityLogger.logSecurityEvent({
          eventType: 'AUTHENTICATION',
          severity: 'HIGH',
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
          eventType: 'AUTHENTICATION',
          severity: 'HIGH',
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
          eventType: 'AUTHENTICATION',
          severity: 'MEDIUM',
          message: 'Expired admin verification code attempted',
          ip: requestIp,
          userAgent,
          endpoint: '/api/admin/verify-code'
        });
        return { success: false, message: 'Verification code has expired' };
      }

      // Mark as used
      verification.used = true;

      // Generate admin session token
      const adminToken = crypto.randomBytes(32).toString('hex');

      securityLogger.logSecurityEvent({
        eventType: 'AUTHENTICATION',
        severity: 'MEDIUM',
        message: 'Admin verification successful',
        ip: requestIp,
        userAgent,
        endpoint: '/api/admin/verify-code',
        details: { adminEmail: verification.email }
      });

      // Clean up expired codes
      this.cleanupExpiredCodes();

      return { 
        success: true, 
        message: 'Admin access granted', 
        token: adminToken 
      };

    } catch (error) {
      console.error('Error verifying admin code:', error);
      securityLogger.logSecurityEvent({
        eventType: 'ERROR',
        severity: 'HIGH',
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
   * Get active verification stats (for monitoring)
   */
  getVerificationStats(): { active: number; used: number; expired: number } {
    this.cleanupExpiredCodes();
    const codes = Array.from(this.verificationCodes.values());
    return {
      active: codes.filter(c => !c.used).length,
      used: codes.filter(c => c.used).length,
      expired: 0 // Already cleaned up
    };
  }
}

export const adminVerificationService = AdminVerificationService.getInstance();