import type { Express } from 'express';
import { z } from 'zod';
import { totpService } from './totp-service';
import { requireUserAuth } from './auth';
import { getClientInfo, securityLogger } from './security-logger';
import { db } from './db-with-fallback';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Input validation schemas
const setupTotpSchema = z.object({
  email: z.string().email(),
});

const completeTotpSetupSchema = z.object({
  secret: z.string().min(1),
  backupCodes: z.array(z.string()),
  verificationToken: z.string().length(6),
});

const verifyTotpSchema = z.object({
  token: z.string().min(1),
});

const verifyBackupCodeSchema = z.object({
  backupCode: z.string().min(1),
});

export function registerTotpRoutes(app: Express) {
  
  /**
   * Initialize TOTP setup - generates secret and QR code
   */
  app.post('/api/totp/setup', requireUserAuth, async (req: any, res) => {
    try {
      const { email } = setupTotpSchema.parse(req.body);
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Check if user already has TOTP enabled
      const status = await totpService.getTotpStatus(userId);
      if (status.enabled) {
        return res.status(400).json({
          error: 'TOTP already enabled for this account',
          code: 'TOTP_ALREADY_ENABLED'
        });
      }

      // Generate TOTP setup data
      const setupData = await totpService.setupTotp(userId, email);

      securityLogger.logSecurityEvent({
        eventType: 'TOTP_SETUP_INITIATED' as any,
        severity: 'LOW' as any,
        message: 'TOTP setup initiated',
        ip,
        userAgent,
        details: { userId }
      });

      // Return setup data (don't log secret)
      res.json({
        message: 'TOTP setup initiated',
        qrCodeUrl: setupData.qrCodeUrl,
        manualEntry: setupData.manual,
        backupCodes: setupData.backupCodes,
        // Secret is needed for the completion step
        secret: setupData.secret
      });

    } catch (error) {
      console.error('TOTP setup error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid input data',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to initiate TOTP setup',
        code: 'TOTP_SETUP_ERROR'
      });
    }
  });

  /**
   * Complete TOTP setup - verifies token and saves configuration
   */
  app.post('/api/totp/complete-setup', requireUserAuth, async (req: any, res) => {
    try {
      const { secret, backupCodes, verificationToken } = completeTotpSetupSchema.parse(req.body);
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Complete the TOTP setup
      const success = await totpService.completeSetup(userId, secret, backupCodes, verificationToken);

      if (!success) {
        securityLogger.logSecurityEvent({
          eventType: 'TOTP_SETUP_FAILED' as any,
          severity: 'MEDIUM' as any,
          message: 'TOTP setup failed - invalid verification token',
          ip,
          userAgent,
          details: { userId }
        });

        return res.status(400).json({
          error: 'Invalid verification token',
          code: 'INVALID_VERIFICATION_TOKEN'
        });
      }

      res.json({
        message: 'TOTP authentication successfully enabled',
        status: 'enabled'
      });

    } catch (error) {
      console.error('TOTP completion error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid input data',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to complete TOTP setup',
        code: 'TOTP_COMPLETION_ERROR'
      });
    }
  });

  /**
   * Verify TOTP token during login or for sensitive operations
   */
  app.post('/api/totp/verify', requireUserAuth, async (req: any, res) => {
    try {
      const { token } = verifyTotpSchema.parse(req.body);
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Verify the TOTP token
      const isValid = await totpService.verifyToken(userId, token);

      if (!isValid) {
        securityLogger.logSecurityEvent({
          eventType: 'TOTP_VERIFICATION_FAILED' as any,
          severity: 'MEDIUM' as any,
          message: 'TOTP token verification failed',
          ip,
          userAgent,
          details: { userId }
        });

        return res.status(400).json({
          error: 'Invalid TOTP token',
          code: 'INVALID_TOTP_TOKEN'
        });
      }

      securityLogger.logSecurityEvent({
        eventType: 'TOTP_VERIFICATION_SUCCESS' as any,
        severity: 'LOW' as any,
        message: 'TOTP token verified successfully',
        ip,
        userAgent,
        details: { userId }
      });

      res.json({
        message: 'TOTP token verified successfully',
        verified: true
      });

    } catch (error) {
      console.error('TOTP verification error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid input data',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to verify TOTP token',
        code: 'TOTP_VERIFICATION_ERROR'
      });
    }
  });

  /**
   * Verify backup code as alternative to TOTP
   */
  app.post('/api/totp/verify-backup', requireUserAuth, async (req: any, res) => {
    try {
      const { backupCode } = verifyBackupCodeSchema.parse(req.body);
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Verify the backup code
      const isValid = await totpService.verifyBackupCode(userId, backupCode);

      if (!isValid) {
        securityLogger.logSecurityEvent({
          eventType: 'BACKUP_CODE_VERIFICATION_FAILED' as any,
          severity: 'MEDIUM' as any,
          message: 'Backup code verification failed',
          ip,
          userAgent,
          details: { userId }
        });

        return res.status(400).json({
          error: 'Invalid backup code',
          code: 'INVALID_BACKUP_CODE'
        });
      }

      // Get remaining backup codes count
      const status = await totpService.getTotpStatus(userId);

      res.json({
        message: 'Backup code verified successfully',
        verified: true,
        remainingBackupCodes: status.backupCodesRemaining || 0
      });

    } catch (error) {
      console.error('Backup code verification error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid input data',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to verify backup code',
        code: 'BACKUP_CODE_VERIFICATION_ERROR'
      });
    }
  });

  /**
   * Get TOTP status for current user
   */
  app.get('/api/totp/status', requireUserAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const status = await totpService.getTotpStatus(userId);

      res.json({
        totpEnabled: status.enabled,
        hasBackupCodes: status.hasBackupCodes,
        backupCodesRemaining: status.backupCodesRemaining
      });

    } catch (error) {
      console.error('TOTP status error:', error);
      res.status(500).json({
        error: 'Failed to get TOTP status',
        code: 'TOTP_STATUS_ERROR'
      });
    }
  });

  /**
   * Regenerate backup codes
   */
  app.post('/api/totp/regenerate-backup-codes', requireUserAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Check if TOTP is enabled
      const status = await totpService.getTotpStatus(userId);
      if (!status.enabled) {
        return res.status(400).json({
          error: 'TOTP not enabled for this account',
          code: 'TOTP_NOT_ENABLED'
        });
      }

      // Regenerate backup codes
      const newBackupCodes = await totpService.regenerateBackupCodes(userId);

      if (!newBackupCodes) {
        return res.status(500).json({
          error: 'Failed to regenerate backup codes',
          code: 'BACKUP_CODE_REGENERATION_ERROR'
        });
      }

      securityLogger.logSecurityEvent({
        eventType: 'BACKUP_CODES_REGENERATED' as any,
        severity: 'LOW' as any,
        message: 'Backup codes regenerated',
        ip,
        userAgent,
        details: { userId }
      });

      res.json({
        message: 'Backup codes regenerated successfully',
        backupCodes: newBackupCodes
      });

    } catch (error) {
      console.error('Backup code regeneration error:', error);
      res.status(500).json({
        error: 'Failed to regenerate backup codes',
        code: 'BACKUP_CODE_REGENERATION_ERROR'
      });
    }
  });

  /**
   * Disable TOTP authentication
   */
  app.post('/api/totp/disable', requireUserAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Check if TOTP is enabled
      const status = await totpService.getTotpStatus(userId);
      if (!status.enabled) {
        return res.status(400).json({
          error: 'TOTP not enabled for this account',
          code: 'TOTP_NOT_ENABLED'
        });
      }

      // Disable TOTP
      const success = await totpService.disableTotp(userId);

      if (!success) {
        return res.status(500).json({
          error: 'Failed to disable TOTP',
          code: 'TOTP_DISABLE_ERROR'
        });
      }

      securityLogger.logSecurityEvent({
        eventType: 'TOTP_DISABLED' as any,
        severity: 'MEDIUM' as any,
        message: 'TOTP authentication disabled',
        ip,
        userAgent,
        details: { userId }
      });

      res.json({
        message: 'TOTP authentication disabled successfully',
        status: 'disabled'
      });

    } catch (error) {
      console.error('TOTP disable error:', error);
      res.status(500).json({
        error: 'Failed to disable TOTP',
        code: 'TOTP_DISABLE_ERROR'
      });
    }
  });
}