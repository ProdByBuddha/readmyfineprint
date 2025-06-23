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
        const data = typeof rateLimitData === 'string' ? JSON.parse(rateLimitData) : rateLimitData;
        const windowStart = new Date(data.windowStart);
        const now = new Date();

        // Check if we're still in the same rate limit window
        if (now.getTime() - windowStart.getTime() < this.RATE_LIMIT_WINDOW) {
          if (data.attempts >= this.MAX_CODES_PER_WINDOW) {
            return false; // Rate limit exceeded
          }

          // Increment attempts in current window
          data.attempts++;
          try {
            await replitTokenStorage.storeDeviceData(rateLimitKey, data);
          } catch (storeError) {
            console.warn('Failed to update rate limit data, but allowing request:', storeError);
            // Don't fail the request if we can't store rate limit data
          }
        } else {
          // New window, reset counter
          try {
            await replitTokenStorage.storeDeviceData(rateLimitKey, {
              windowStart: now.toISOString(),
              attempts: 1
            });
          } catch (storeError) {
            console.warn('Failed to store new rate limit window, but allowing request:', storeError);
            // Don't fail the request if we can't store rate limit data
          }
        }
      } else {
        // First attempt in this window
        try {
          await replitTokenStorage.storeDeviceData(rateLimitKey, {
            windowStart: new Date().toISOString(),
            attempts: 1
          });
        } catch (storeError) {
          console.warn('Failed to store initial rate limit data, but allowing request:', storeError);
          // Don't fail the request if we can't store rate limit data
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
      try {
        await replitTokenStorage.storeDeviceData(verificationKey, verificationData);
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
const nodemailer = require('nodemailer');

// async..await is not allowed in global scope, must use a wrapper
export async function sendEmail(email: string, code: string) {
  // Generate test SMTP service account from ethereal.email
  // Only needed if you don't have a real mail account for testing
  // let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // generated ethereal user
      pass: process.env.SMTP_PASS, // generated ethereal password
    },
  });

  const mailOptions = {
        from: {
          name: 'ReadMyFinePrint',
          address: process.env.SECURITY_EMAIL_FROM || process.env.FROM_EMAIL || 'admin@readmyfineprint.com'
        },
        to: email,
        subject: `🔐 Your ReadMyFinePrint verification code: ${code}`,
        text: `Your verification code is ${code}. This code will expire in 10 minutes.`,
        html: `<p>Your verification code is <b>${code}</b>. This code will expire in 10 minutes.</p>`,
  };

  // send mail with defined transport object
  let info = await transporter.sendMail(mailOptions);

  console.log('Message sent: %s', info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}