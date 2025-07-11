import crypto from 'crypto';
import { db } from './db';
import { twoFactorCodes, users } from '@shared/schema';
import { eq, and, lt, gt } from 'drizzle-orm';
import { emailService } from './email-service';
import { securityLogger, getClientInfo } from './security-logger';

interface TwoFactorOptions {
  codeLength?: number;
  expiryMinutes?: number;
  maxAttempts?: number;
  rateLimitMinutes?: number;
  maxCodesPerHour?: number;
}

class TwoFactorService {
  private readonly defaultOptions: Required<TwoFactorOptions> = {
    codeLength: 6,
    expiryMinutes: 10,
    maxAttempts: 3,
    rateLimitMinutes: 5,
    maxCodesPerHour: 6,
  };

  /**
   * Generate a cryptographically secure numeric code
   */
  private generateCode(length: number = 6): string {
    const max = Math.pow(10, length) - 1;
    const min = Math.pow(10, length - 1);
    
    // Use crypto.randomInt for cryptographically secure random numbers
    const code = crypto.randomInt(min, max + 1);
    return code.toString().padStart(length, '0');
  }

  /**
   * Check rate limiting for 2FA code generation
   */
  private async checkRateLimit(userId: string, maxCodesPerHour: number): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    try {
      const recentCodes = await db
        .select()
        .from(twoFactorCodes)
        .where(
          and(
            eq(twoFactorCodes.userId, userId),
            gt(twoFactorCodes.createdAt, oneHourAgo)
          )
        );

      return recentCodes.length < maxCodesPerHour;
    } catch (error) {
      console.error('Error checking 2FA rate limit:', error);
      return false;
    }
  }

  /**
   * Clean up expired codes for a user
   */
  private async cleanupExpiredCodes(userId: string): Promise<void> {
    try {
      await db
        .delete(twoFactorCodes)
        .where(
          and(
            eq(twoFactorCodes.userId, userId),
            lt(twoFactorCodes.expiresAt, new Date())
          )
        );
    } catch (error) {
      console.error('Error cleaning up expired 2FA codes:', error);
    }
  }

  /**
   * Send 2FA code via email
   */
  private async sendCodeByEmail(
    email: string,
    code: string,
    type: string,
    userName?: string
  ): Promise<boolean> {
    const subject = this.getEmailSubject(type);
    const body = this.getEmailBody(code, type, userName);

    try {
      await emailService.sendEmail({
        to: email,
        subject,
        html: body,
        text: `Your verification code is: ${code}. This code expires in 10 minutes.`,
      });

      return true;
    } catch (error) {
      console.error('Failed to send 2FA code email:', error);
      return false;
    }
  }

  /**
   * Get email subject based on 2FA type
   */
  private getEmailSubject(type: string): string {
    switch (type) {
      case 'login':
        return 'ReadMyFinePrint - Login Verification Code';
      case 'enable_2fa':
        return 'ReadMyFinePrint - Enable Two-Factor Authentication';
      case 'disable_2fa':
        return 'ReadMyFinePrint - Disable Two-Factor Authentication';
      default:
        return 'ReadMyFinePrint - Verification Code';
    }
  }

  /**
   * Get email body based on 2FA type
   */
  private getEmailBody(code: string, type: string, userName?: string): string {
    const greeting = userName ? `Hello ${userName}` : 'Hello';
    
    const typeMessages = {
      login: 'Someone is trying to log in to your ReadMyFinePrint account.',
      enable_2fa: 'You are enabling two-factor authentication for your ReadMyFinePrint account.',
      disable_2fa: 'You are disabling two-factor authentication for your ReadMyFinePrint account.',
    };

    const message = typeMessages[type as keyof typeof typeMessages] || 'You requested a verification code.';

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">ReadMyFinePrint Security Code</h2>
            
            <p>${greeting},</p>
            
            <p>${message}</p>
            
            <div style="background-color: #f8f9fa; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <h3 style="margin: 0; color: #2563eb;">Your verification code is:</h3>
              <div style="font-size: 32px; font-weight: bold; color: #1f2937; letter-spacing: 4px; margin: 10px 0;">
                ${code}
              </div>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
                This code expires in 10 minutes
              </p>
            </div>
            
            <p><strong>Security Notice:</strong></p>
            <ul>
              <li>Never share this code with anyone</li>
              <li>ReadMyFinePrint will never ask for your code via phone or email</li>
              <li>If you didn't request this code, please secure your account immediately</li>
            </ul>
            
            <p>If you need help, contact our support team.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              This is an automated message from ReadMyFinePrint. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate and send a 2FA code
   */
  async generateAndSendCode(
    userId: string,
    type: 'login' | 'enable_2fa' | 'disable_2fa',
    options: TwoFactorOptions = {},
    req?: any
  ): Promise<{ success: boolean; message: string; codeId?: string }> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Get user information
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return { success: false, message: 'User not found' };
      }

      const userData = user[0];

      // Check rate limiting
      const rateLimitOk = await this.checkRateLimit(userId, opts.maxCodesPerHour);
      if (!rateLimitOk) {
        if (req) {
          const { ip, userAgent } = getClientInfo(req);
          securityLogger.logSecurityEvent({
            eventType: "RATE_LIMIT_EXCEEDED" as any,
            severity: "HIGH" as any,
            message: `2FA code rate limit exceeded for user ${userId}`,
            ip,
            userAgent,
            endpoint: req.path,
            details: { userId, type, maxCodesPerHour: opts.maxCodesPerHour }
          });
        }
        return { success: false, message: 'Too many verification codes requested. Please wait before requesting another.' };
      }

      // Clean up expired codes
      await this.cleanupExpiredCodes(userId);

      // Determine which email to send to
      let targetEmail = userData.email;
      if (type === 'login' && userData.backupEmail) {
        // For login, prefer backup email if available for additional security
        targetEmail = userData.backupEmail;
      }

      // Generate code
      const code = this.generateCode(opts.codeLength);
      const expiresAt = new Date(Date.now() + opts.expiryMinutes * 60 * 1000);

      // Save code to database
      const insertResult = await db
        .insert(twoFactorCodes)
        .values({
          userId,
          code,
          type,
          email: targetEmail,
          maxAttempts: opts.maxAttempts,
          expiresAt,
        })
        .returning({ id: twoFactorCodes.id });

      if (!insertResult.length) {
        return { success: false, message: 'Failed to generate verification code' };
      }

      const codeId = insertResult[0].id;

      // Send code via email
      const emailSent = await this.sendCodeByEmail(targetEmail, code, type, userData.email.split('@')[0]);

      if (!emailSent) {
        // Clean up the code if email failed
        await db.delete(twoFactorCodes).where(eq(twoFactorCodes.id, codeId));
        return { success: false, message: 'Failed to send verification code' };
      }

      // Log security event
      if (req) {
        const { ip, userAgent } = getClientInfo(req);
        securityLogger.logSecurityEvent({
          eventType: "TWO_FACTOR_CODE_SENT" as any,
          severity: "LOW" as any,
          message: `2FA code sent for ${type}`,
          ip,
          userAgent,
          endpoint: req.path,
          details: { userId, type, email: targetEmail, codeId }
        });
      }

      return {
        success: true,
        message: `Verification code sent to ${this.maskEmail(targetEmail)}`,
        codeId,
      };

    } catch (error) {
      console.error('Error generating 2FA code:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Verify a 2FA code
   */
  async verifyCode(
    userId: string,
    code: string,
    type: 'login' | 'enable_2fa' | 'disable_2fa',
    req?: any
  ): Promise<{ success: boolean; message: string; codeId?: string }> {
    try {
      // Find valid, unused code
      const validCodes = await db
        .select()
        .from(twoFactorCodes)
        .where(
          and(
            eq(twoFactorCodes.userId, userId),
            eq(twoFactorCodes.type, type),
            eq(twoFactorCodes.isUsed, false),
            gt(twoFactorCodes.expiresAt, new Date())
          )
        )
        .orderBy(twoFactorCodes.createdAt);

      if (!validCodes.length) {
        if (req) {
          const { ip, userAgent } = getClientInfo(req);
          securityLogger.logSecurityEvent({
            eventType: "TWO_FACTOR_CODE_NOT_FOUND" as any,
            severity: "MEDIUM" as any,
            message: `No valid 2FA code found for verification`,
            ip,
            userAgent,
            endpoint: req.path,
            details: { userId, type, providedCode: code.substring(0, 2) + '****' }
          });
        }
        return { success: false, message: 'Invalid or expired verification code' };
      }

      const codeRecord = validCodes[0];

      // Check attempt limit
      if (codeRecord.attempts >= codeRecord.maxAttempts) {
        // Mark as used to prevent further attempts
        await db
          .update(twoFactorCodes)
          .set({ isUsed: true })
          .where(eq(twoFactorCodes.id, codeRecord.id));

        if (req) {
          const { ip, userAgent } = getClientInfo(req);
          securityLogger.logSecurityEvent({
            eventType: "TWO_FACTOR_MAX_ATTEMPTS" as any,
            severity: "HIGH" as any,
            message: `2FA code max attempts exceeded`,
            ip,
            userAgent,
            endpoint: req.path,
            details: { userId, type, codeId: codeRecord.id, attempts: codeRecord.attempts }
          });
        }

        return { success: false, message: 'Too many failed attempts. Please request a new code.' };
      }

      // Increment attempt counter
      await db
        .update(twoFactorCodes)
        .set({ attempts: codeRecord.attempts + 1 })
        .where(eq(twoFactorCodes.id, codeRecord.id));

      // Verify code using timing-safe comparison
      const providedCodeBuffer = Buffer.from(code, 'utf8');
      const storedCodeBuffer = Buffer.from(codeRecord.code, 'utf8');

      if (providedCodeBuffer.length !== storedCodeBuffer.length || 
          !crypto.timingSafeEqual(providedCodeBuffer, storedCodeBuffer)) {
        
        if (req) {
          const { ip, userAgent } = getClientInfo(req);
          securityLogger.logSecurityEvent({
            eventType: "TWO_FACTOR_CODE_INVALID" as any,
            severity: "MEDIUM" as any,
            message: `Invalid 2FA code provided`,
            ip,
            userAgent,
            endpoint: req.path,
            details: { userId, type, codeId: codeRecord.id, attempts: codeRecord.attempts + 1 }
          });
        }

        return { success: false, message: 'Invalid verification code' };
      }

      // Mark code as used
      await db
        .update(twoFactorCodes)
        .set({ isUsed: true })
        .where(eq(twoFactorCodes.id, codeRecord.id));

      // Log successful verification
      if (req) {
        const { ip, userAgent } = getClientInfo(req);
        securityLogger.logSecurityEvent({
          eventType: "TWO_FACTOR_CODE_VERIFIED" as any,
          severity: "LOW" as any,
          message: `2FA code successfully verified`,
          ip,
          userAgent,
          endpoint: req.path,
          details: { userId, type, codeId: codeRecord.id }
        });
      }

      return {
        success: true,
        message: 'Verification code confirmed',
        codeId: codeRecord.id,
      };

    } catch (error) {
      console.error('Error verifying 2FA code:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Enable 2FA for a user
   */
  async enableTwoFactor(userId: string, backupEmail?: string): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: any = { twoFactorEnabled: true };
      if (backupEmail) {
        updateData.backupEmail = backupEmail;
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      return { success: true, message: 'Two-factor authentication enabled successfully' };
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      return { success: false, message: 'Failed to enable two-factor authentication' };
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disableTwoFactor(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      await db
        .update(users)
        .set({ 
          twoFactorEnabled: false,
          backupEmail: null 
        })
        .where(eq(users.id, userId));

      // Clean up any existing codes
      await db
        .delete(twoFactorCodes)
        .where(eq(twoFactorCodes.userId, userId));

      return { success: true, message: 'Two-factor authentication disabled successfully' };
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      return { success: false, message: 'Failed to disable two-factor authentication' };
    }
  }

  /**
   * Check if user has 2FA enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    try {
      const user = await db
        .select({ twoFactorEnabled: users.twoFactorEnabled })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user.length > 0 && user[0].twoFactorEnabled;
    } catch (error) {
      console.error('Error checking 2FA status:', error);
      return false;
    }
  }

  /**
   * Get 2FA settings for a user
   */
  async getSettings(userId: string): Promise<{
    enabled: boolean;
    backupEmail?: string;
    hasPendingCodes: boolean;
  }> {
    try {
      const user = await db
        .select({
          twoFactorEnabled: users.twoFactorEnabled,
          backupEmail: users.backupEmail,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return { enabled: false, hasPendingCodes: false };
      }

      // Check for pending codes
      const pendingCodes = await db
        .select()
        .from(twoFactorCodes)
        .where(
          and(
            eq(twoFactorCodes.userId, userId),
            eq(twoFactorCodes.isUsed, false),
            gt(twoFactorCodes.expiresAt, new Date())
          )
        )
        .limit(1);

      return {
        enabled: user[0].twoFactorEnabled,
        backupEmail: user[0].backupEmail || undefined,
        hasPendingCodes: pendingCodes.length > 0,
      };
    } catch (error) {
      console.error('Error getting 2FA settings:', error);
      return { enabled: false, hasPendingCodes: false };
    }
  }

  /**
   * Clean up expired codes (utility function)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await db
        .delete(twoFactorCodes)
        .where(lt(twoFactorCodes.expiresAt, new Date()));

      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up expired 2FA codes:', error);
      return 0;
    }
  }

  /**
   * Mask email for display
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`;
    }
    return `${local.substring(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
  }
}

// Create singleton instance
export const twoFactorService = new TwoFactorService();

// Export the service class for testing
export { TwoFactorService };