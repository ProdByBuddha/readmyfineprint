import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import crypto from 'crypto';
import { db } from './db';
import { totpSecrets, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { securityLogger } from './security-logger';

interface TotpSetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manual: string;
}

interface TotpOptions {
  appName?: string;
  issuer?: string;
  window?: number;
  backupCodeCount?: number;
}

class TotpService {
  private readonly defaultOptions: Required<TotpOptions> = {
    appName: 'ReadMyFinePrint',
    issuer: 'ReadMyFinePrint',
    window: 1, // Allow 1 step before/after current time (30 seconds tolerance)
    backupCodeCount: 10,
  };

  private readonly encryptionKey: Buffer;

  constructor() {
    // Use environment variable or generate a key for encryption
    const keyString = process.env.TOTP_ENCRYPTION_KEY || 'readmyfineprint-totp-default-key-change-in-production';
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('totp-secret', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    try {
      const { encrypted, iv, authTag } = JSON.parse(encryptedData);
      
      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
      decipher.setAAD(Buffer.from('totp-secret', 'utf8'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt TOTP data:', error);
      throw new Error('Failed to decrypt TOTP data');
    }
  }

  /**
   * Generate backup codes for recovery
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric backup codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Set up TOTP for a user - generates secret and QR code
   */
  async setupTotp(userId: string, userEmail: string, options: TotpOptions = {}): Promise<TotpSetupData> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // Generate a new secret for the user
      const secret = authenticator.generateSecret();
      
      // Create the service name for the authenticator app
      const serviceName = `${opts.issuer}:${userEmail}`;
      
      // Generate the key URI for QR code
      const keyUri = authenticator.keyuri(userEmail, opts.issuer, secret);
      
      // Generate QR code as data URL
      const qrCodeUrl = await QRCode.toDataURL(keyUri);
      
      // Generate backup codes
      const backupCodes = this.generateBackupCodes(opts.backupCodeCount);
      
      // Create manual entry string for users who can't scan QR codes
      const manual = `Secret: ${secret.match(/.{1,4}/g)?.join(' ') || secret}`;

      console.log(`🔐 TOTP setup initiated for user ${userId}`);
      
      return {
        secret,
        qrCodeUrl,
        backupCodes,
        manual
      };
    } catch (error) {
      console.error('Error setting up TOTP:', error);
      throw new Error('Failed to setup TOTP authentication');
    }
  }

  /**
   * Complete TOTP setup by saving encrypted secret and backup codes
   */
  async completeSetup(userId: string, secret: string, backupCodes: string[], verificationToken: string): Promise<boolean> {
    try {
      // Verify the provided token against the secret
      const isValid = authenticator.check(verificationToken, secret);
      if (!isValid) {
        console.log(`❌ Invalid TOTP verification token for user ${userId}`);
        return false;
      }

      // Encrypt the secret and backup codes
      const encryptedSecret = this.encrypt(secret);
      const encryptedBackupCodes = this.encrypt(JSON.stringify(backupCodes));

      // Save to database
      await db.insert(totpSecrets).values({
        userId,
        encryptedSecret,
        backupCodes: encryptedBackupCodes,
        isActive: true,
      }).onConflictDoUpdate({
        target: totpSecrets.userId,
        set: {
          encryptedSecret,
          backupCodes: encryptedBackupCodes,
          isActive: true,
          updatedAt: new Date(),
        }
      });

      // Enable 2FA on user account
      await db.update(users)
        .set({ twoFactorEnabled: true })
        .where(eq(users.id, userId));

      console.log(`✅ TOTP setup completed for user ${userId}`);
      securityLogger.logSecurityEvent({
        eventType: 'TOTP_ENABLED' as any,
        severity: 'MEDIUM' as any,
        message: 'TOTP authentication enabled',
        ip: '',
        userAgent: '',
        details: { userId, method: 'totp' }
      });

      return true;
    } catch (error) {
      console.error('Error completing TOTP setup:', error);
      return false;
    }
  }

  /**
   * Verify a TOTP token for a user
   */
  async verifyToken(userId: string, token: string): Promise<boolean> {
    try {
      const totpRecord = await db
        .select()
        .from(totpSecrets)
        .where(eq(totpSecrets.userId, userId))
        .limit(1);

      if (!totpRecord.length || !totpRecord[0].isActive) {
        console.log(`❌ No active TOTP setup found for user ${userId}`);
        return false;
      }

      const record = totpRecord[0];
      
      // Decrypt the secret
      const secret = this.decrypt(record.encryptedSecret);
      
      // Verify the token
      const isValid = authenticator.check(token, secret);
      
      if (isValid) {
        // Update last used timestamp to prevent replay attacks
        await db.update(totpSecrets)
          .set({ lastUsedAt: new Date() })
          .where(eq(totpSecrets.userId, userId));

        console.log(`✅ TOTP token verified for user ${userId}`);
      } else {
        console.log(`❌ Invalid TOTP token for user ${userId}`);
      }

      return isValid;
    } catch (error) {
      console.error('Error verifying TOTP token:', error);
      return false;
    }
  }

  /**
   * Verify a backup code for a user
   */
  async verifyBackupCode(userId: string, backupCode: string): Promise<boolean> {
    try {
      const totpRecord = await db
        .select()
        .from(totpSecrets)
        .where(eq(totpSecrets.userId, userId))
        .limit(1);

      if (!totpRecord.length || !totpRecord[0].isActive || !totpRecord[0].backupCodes) {
        console.log(`❌ No active TOTP backup codes found for user ${userId}`);
        return false;
      }

      const record = totpRecord[0];
      
      // Decrypt the backup codes
      const backupCodesJson = this.decrypt(record.backupCodes);
      const backupCodes: string[] = JSON.parse(backupCodesJson);
      
      // Check if the provided code exists in backup codes
      const codeIndex = backupCodes.findIndex(code => code.toUpperCase() === backupCode.toUpperCase());
      
      if (codeIndex === -1) {
        console.log(`❌ Invalid backup code for user ${userId}`);
        return false;
      }

      // Remove the used backup code
      backupCodes.splice(codeIndex, 1);
      const updatedBackupCodes = this.encrypt(JSON.stringify(backupCodes));

      // Update the database
      await db.update(totpSecrets)
        .set({ 
          backupCodes: updatedBackupCodes,
          lastUsedAt: new Date()
        })
        .where(eq(totpSecrets.userId, userId));

      console.log(`✅ Backup code verified for user ${userId}. ${backupCodes.length} codes remaining.`);
      
      securityLogger.logSecurityEvent({
        eventType: 'BACKUP_CODE_USED' as any,
        severity: 'MEDIUM' as any,
        message: 'TOTP backup code used',
        ip: '',
        userAgent: '',
        details: { userId, remainingCodes: backupCodes.length }
      });

      return true;
    } catch (error) {
      console.error('Error verifying backup code:', error);
      return false;
    }
  }

  /**
   * Disable TOTP for a user
   */
  async disableTotp(userId: string): Promise<boolean> {
    try {
      // Deactivate TOTP record
      await db.update(totpSecrets)
        .set({ isActive: false })
        .where(eq(totpSecrets.userId, userId));

      // Disable 2FA on user account
      await db.update(users)
        .set({ twoFactorEnabled: false })
        .where(eq(users.id, userId));

      console.log(`🔓 TOTP disabled for user ${userId}`);
      
      securityLogger.logSecurityEvent({
        eventType: 'TOTP_DISABLED' as any,
        severity: 'MEDIUM' as any,
        message: 'TOTP authentication disabled',
        ip: '',
        userAgent: '',
        details: { userId }
      });

      return true;
    } catch (error) {
      console.error('Error disabling TOTP:', error);
      return false;
    }
  }

  /**
   * Get TOTP status for a user
   */
  async getTotpStatus(userId: string): Promise<{
    enabled: boolean;
    hasBackupCodes: boolean;
    backupCodesRemaining?: number;
  }> {
    try {
      const totpRecord = await db
        .select()
        .from(totpSecrets)
        .where(eq(totpSecrets.userId, userId))
        .limit(1);

      if (!totpRecord.length) {
        return { enabled: false, hasBackupCodes: false };
      }

      const record = totpRecord[0];
      let backupCodesRemaining = 0;

      if (record.backupCodes) {
        try {
          const backupCodesJson = this.decrypt(record.backupCodes);
          const backupCodes: string[] = JSON.parse(backupCodesJson);
          backupCodesRemaining = backupCodes.length;
        } catch (error) {
          console.error('Error decrypting backup codes:', error);
        }
      }

      return {
        enabled: record.isActive,
        hasBackupCodes: backupCodesRemaining > 0,
        backupCodesRemaining
      };
    } catch (error) {
      console.error('Error getting TOTP status:', error);
      return { enabled: false, hasBackupCodes: false };
    }
  }

  /**
   * Generate new backup codes for a user
   */
  async regenerateBackupCodes(userId: string): Promise<string[] | null> {
    try {
      const totpRecord = await db
        .select()
        .from(totpSecrets)
        .where(eq(totpSecrets.userId, userId))
        .limit(1);

      if (!totpRecord.length || !totpRecord[0].isActive) {
        console.log(`❌ No active TOTP setup found for user ${userId}`);
        return null;
      }

      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes(this.defaultOptions.backupCodeCount);
      const encryptedBackupCodes = this.encrypt(JSON.stringify(newBackupCodes));

      // Update the database
      await db.update(totpSecrets)
        .set({ 
          backupCodes: encryptedBackupCodes,
          updatedAt: new Date()
        })
        .where(eq(totpSecrets.userId, userId));

      console.log(`🔄 Backup codes regenerated for user ${userId}`);
      
      securityLogger.logSecurityEvent({
        eventType: 'BACKUP_CODES_REGENERATED' as any,
        severity: 'LOW' as any,
        message: 'TOTP backup codes regenerated',
        ip: '',
        userAgent: '',
        details: { userId }
      });

      return newBackupCodes;
    } catch (error) {
      console.error('Error regenerating backup codes:', error);
      return null;
    }
  }
}

// Export singleton instance
export const totpService = new TotpService();