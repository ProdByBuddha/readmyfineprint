import crypto from 'crypto';
import { replitTokenStorage } from './replit-token-storage';

interface VerificationCode {
  code: string;
  email: string;
  deviceFingerprint: string;
  clientIp: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

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
    const rateLimitKey = `verification_rate_limit:${email}:${clientIp}`;
    
    try {
      const rateLimitData = await replitTokenStorage.getDeviceData(rateLimitKey);
      if (rateLimitData) {
        const data = JSON.parse(rateLimitData);
        const windowStart = new Date(data.windowStart);
        const now = new Date();
        
        // Check if we're still in the same rate limit window
        if (now.getTime() - windowStart.getTime() < this.RATE_LIMIT_WINDOW) {
          if (data.attempts >= this.MAX_CODES_PER_WINDOW) {
            return false; // Rate limit exceeded
          }
          
          // Increment attempts in current window
          data.attempts++;
          await replitTokenStorage.storeDeviceData(rateLimitKey, data);
        } else {
          // New window, reset counter
          await replitTokenStorage.storeDeviceData(rateLimitKey, {
            windowStart: now.toISOString(),
            attempts: 1
          });
        }
      } else {
        // First attempt in this window
        await replitTokenStorage.storeDeviceData(rateLimitKey, {
          windowStart: new Date().toISOString(),
          attempts: 1
        });
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
      
      const verificationData: VerificationCode = {
        code,
        email,
        deviceFingerprint,
        clientIp,
        expiresAt,
        attempts: 0,
        maxAttempts: this.MAX_ATTEMPTS,
        createdAt: new Date()
      };

      // Store with email as key for easy retrieval
      const verificationKey = `email_verification:${email}:${deviceFingerprint}`;
      await replitTokenStorage.storeDeviceData(verificationKey, verificationData);

      console.log(`✅ Generated verification code for ${email} (expires: ${expiresAt.toISOString()})`);
      
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
      const verificationKey = `email_verification:${email}:${deviceFingerprint}`;
      const storedData = await replitTokenStorage.getDeviceData(verificationKey);
      
      if (!storedData) {
        return {
          success: false,
          error: 'No verification code found. Please request a new code.'
        };
      }

      const verificationData: VerificationCode = storedData;
      
      // Check if code has expired
      if (new Date() > new Date(verificationData.expiresAt)) {
        await replitTokenStorage.deleteDeviceData(verificationKey);
        return {
          success: false,
          error: 'Verification code has expired. Please request a new code.'
        };
      }

      // Check attempt limits
      if (verificationData.attempts >= verificationData.maxAttempts) {
        await replitTokenStorage.deleteDeviceData(verificationKey);
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
        await replitTokenStorage.deleteDeviceData(verificationKey);
        console.log(`✅ Email verification successful for ${email}`);
        
        return {
          success: true
        };
      } else {
        // Increment attempts and update storage
        verificationData.attempts++;
        const attemptsRemaining = verificationData.maxAttempts - verificationData.attempts;
        
        if (attemptsRemaining > 0) {
          await replitTokenStorage.storeDeviceData(verificationKey, verificationData);
        } else {
          // Max attempts reached, delete the code
          await replitTokenStorage.deleteDeviceData(verificationKey);
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
      // This will be handled automatically by Replit Database TTL
      console.log('🧹 Expired verification codes cleaned up automatically by TTL');
    } catch (error) {
      console.error('Failed to cleanup expired codes:', error);
    }
  }
}

export const emailVerificationService = new EmailVerificationService();