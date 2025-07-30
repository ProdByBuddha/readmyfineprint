import crypto from 'crypto';
import { db } from './db';
import { emailVerificationCodes, emailVerificationRateLimit } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { emailService } from './email-service';

export class EmailVerificationService {
  private readonly CODE_LENGTH = 6;
  private readonly CODE_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_CODES_PER_WINDOW = 3;

  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    // Generate cryptographically secure random 6-digit code
    const buffer = crypto.randomBytes(3);
    const code = buffer.readUIntBE(0, 3) % 1000000;
    return code.toString().padStart(6, '0');
  }

  /**
   * Check rate limiting for code generation
   */
  private async checkRateLimit(email: string, clientIp: string): Promise<boolean> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.RATE_LIMIT_WINDOW);
      
      // Clean up expired rate limit records
      await db.delete(emailVerificationRateLimit)
        .where(lt(emailVerificationRateLimit.windowStart, windowStart));
      
      // Check current rate limit for this email/IP combination
      const rateLimitRecord = await db.select()
        .from(emailVerificationRateLimit)
        .where(and(
          eq(emailVerificationRateLimit.email, email),
          eq(emailVerificationRateLimit.clientIp, clientIp)
        ))
        .limit(1);
      
      if (rateLimitRecord.length > 0) {
        const record = rateLimitRecord[0];
        const windowAge = now.getTime() - record.windowStart.getTime();
        
        if (windowAge < this.RATE_LIMIT_WINDOW) {
          if (record.attempts >= this.MAX_CODES_PER_WINDOW) {
            return false; // Rate limit exceeded
          }
          
          // Increment attempts in current window
          try {
            await db.update(emailVerificationRateLimit)
              .set({ attempts: record.attempts + 1 })
              .where(eq(emailVerificationRateLimit.id, record.id));
          } catch (error) {
            console.warn('Failed to update rate limit data, but allowing request:', error);
          }
        } else {
          // Reset the window
          try {
            await db.update(emailVerificationRateLimit)
              .set({ 
                attempts: 1, 
                windowStart: now 
              })
              .where(eq(emailVerificationRateLimit.id, record.id));
          } catch (error) {
            console.warn('Failed to reset rate limit window, but allowing request:', error);
          }
        }
      } else {
        // First attempt in this window
        try {
          await db.insert(emailVerificationRateLimit)
            .values({
              email,
              clientIp,
              attempts: 1,
              windowStart: now
            });
        } catch (error) {
          console.warn('Failed to create rate limit record, but allowing request:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow on error to avoid blocking legitimate users
    }
  }

  /**
   * Generate and store a verification code
   */
  async generateCode(email: string, deviceFingerprint: string, clientIp: string): Promise<{
    success: boolean;
    code?: string;
    expiresAt?: Date;
    error?: string;
  }> {
    try {
      // Check rate limiting
      const rateLimitOk = await this.checkRateLimit(email, clientIp);
      if (!rateLimitOk) {
        return {
          success: false,
          error: 'Too many verification codes requested. Please wait before requesting another.'
        };
      }

      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);

      // Clean up any existing verification codes for this email/device combination
      await db.delete(emailVerificationCodes)
        .where(and(
          eq(emailVerificationCodes.email, email),
          eq(emailVerificationCodes.deviceFingerprint, deviceFingerprint)
        ));

      try {
        await db.insert(emailVerificationCodes)
          .values({
            email,
            code,
            deviceFingerprint,
            clientIp,
            attempts: 0,
            maxAttempts: this.MAX_ATTEMPTS,
            expiresAt
          });
        console.log(`✅ Generated verification code for ${email} (expires: ${expiresAt.toISOString()})`);
      } catch (storeError) {
        console.error('Failed to store verification code:', storeError);
        return {
          success: false,
          error: 'Unable to store verification code. Please try again in a moment.'
        };
      }

      return {
        success: true,
        code,
        expiresAt
      };
    } catch (error) {
      console.error('Failed to generate verification code:', error);
      return {
        success: false,
        error: 'Failed to generate verification code. Please try again.'
      };
    }
  }

  /**
   * Verify a submitted code
   */
  async verifyCode(email: string, submittedCode: string, deviceFingerprint: string, clientIp: string): Promise<{
    success: boolean;
    error?: string;
    attemptsRemaining?: number;
  }> {
    try {
      // Clean up expired codes first (with error handling)
      const now = new Date();
      try {
        await db.delete(emailVerificationCodes)
          .where(lt(emailVerificationCodes.expiresAt, now));
        console.log('✅ Email verification cleanup completed');
      } catch (cleanupError) {
        console.warn('⚠️ Email verification cleanup failed (non-critical):', cleanupError instanceof Error ? cleanupError.message : cleanupError);
        // Continue with verification even if cleanup fails
      }

      // Find the verification code
      const verificationRecord = await db.select()
        .from(emailVerificationCodes)
        .where(and(
          eq(emailVerificationCodes.email, email),
          eq(emailVerificationCodes.deviceFingerprint, deviceFingerprint)
        ))
        .limit(1);

      if (verificationRecord.length === 0) {
        return {
          success: false,
          error: 'No verification code found. Please request a new code.'
        };
      }

      const verificationData = verificationRecord[0];

      // Check if code has expired
      if (now > verificationData.expiresAt) {
        await db.delete(emailVerificationCodes)
          .where(eq(emailVerificationCodes.id, verificationData.id));
        return {
          success: false,
          error: 'Verification code has expired. Please request a new code.'
        };
      }

      // Check attempt limits
      if (verificationData.attempts >= verificationData.maxAttempts) {
        await db.delete(emailVerificationCodes)
          .where(eq(emailVerificationCodes.id, verificationData.id));
        return {
          success: false,
          error: 'Too many failed attempts. Please request a new verification code.'
        };
      }

      // Verify security context matches
      if (verificationData.deviceFingerprint !== deviceFingerprint || 
          verificationData.clientIp !== clientIp) {
        console.warn(`⚠️ Verification attempt security mismatch for ${email}`);
        // Still allow verification but log for monitoring
      }

      // Check if code matches
      if (verificationData.code === submittedCode.trim()) {
        // Success! Clean up the verification code
        await db.delete(emailVerificationCodes)
          .where(eq(emailVerificationCodes.id, verificationData.id));
        console.log(`✅ Email verification successful for ${email}`);

        return {
          success: true
        };
      } else {
        // Increment attempts and update storage
        const newAttempts = verificationData.attempts + 1;
        const attemptsRemaining = verificationData.maxAttempts - newAttempts;

        if (attemptsRemaining > 0) {
          await db.update(emailVerificationCodes)
            .set({ attempts: newAttempts })
            .where(eq(emailVerificationCodes.id, verificationData.id));
        } else {
          // Max attempts reached, delete the code
          await db.delete(emailVerificationCodes)
            .where(eq(emailVerificationCodes.id, verificationData.id));
        }

        return {
          success: false,
          error: attemptsRemaining > 0 
            ? `Invalid verification code. ${attemptsRemaining} attempts remaining.`
            : 'Too many failed attempts. Please request a new verification code.',
          attemptsRemaining: Math.max(0, attemptsRemaining)
        };
      }
    } catch (error) {
      console.error('Failed to verify code:', error);
      return {
        success: false,
        error: 'Failed to verify code. Please try again.'
      };
    }
  }

  /**
   * Clean up expired verification codes
   */
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const now = new Date();
      
      // Clean up expired verification codes
      const deletedCodes = await db.delete(emailVerificationCodes)
        .where(lt(emailVerificationCodes.expiresAt, now));
      
      // Clean up old rate limit records (older than 1 hour)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const deletedRateLimit = await db.delete(emailVerificationRateLimit)
        .where(lt(emailVerificationRateLimit.windowStart, oneHourAgo));
      
      console.log('🧹 Expired verification codes and rate limit records cleaned up');
    } catch (error) {
      console.error('Failed to cleanup expired codes:', error);
    }
  }
}

export const emailVerificationService = new EmailVerificationService();

// Send actual verification email using the email service
export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint Verification Code</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; text-align: center; }
        .code { background: #f1f5f9; border: 2px solid #0891b2; border-radius: 8px; padding: 20px; margin: 20px 0; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0891b2; font-family: 'Courier New', monospace; }
        .message { font-size: 16px; line-height: 1.7; margin: 20px 0; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Verification Code</h1>
            <p>Secure sign-in to ReadMyFinePrint</p>
        </div>
        
        <div class="content">
            <div class="message">
                <p>Your ReadMyFinePrint verification code is:</p>
            </div>
            
            <div class="code">${code}</div>
            
            <div class="warning">
                <p><strong>⏰ Important:</strong> This code will expire in 10 minutes for your security.</p>
            </div>
            
            <div class="message">
                <p>If you didn't request this code, please ignore this email. Your account remains secure.</p>
            </div>
        </div>
        
        <div class="footer">
            <p>ReadMyFinePrint - Secure Legal Document Analysis</p>
            <p>This is an automated security email. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
  `;
  
  const emailText = `
ReadMyFinePrint - Verification Code

Your verification code is: ${code}

This code will expire in 10 minutes for your security.

If you didn't request this code, please ignore this email. Your account remains secure.

---
ReadMyFinePrint - Secure Legal Document Analysis
This is an automated security email. Please do not reply.
  `;

  try {
    const success = await emailService.sendEmail({
      to: email,
      subject: '🔐 Your ReadMyFinePrint Verification Code',
      html: emailHTML,
      text: emailText
    });

    if (success) {
      console.log(`✅ Verification email sent successfully to ${email}`);
    } else {
      console.error(`❌ Failed to send verification email to ${email}`);
    }

    return success;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
}