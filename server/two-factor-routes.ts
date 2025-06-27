import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { twoFactorService } from './two-factor-service';
import { requireUserAuth, requireAdminAuth } from './auth';
import { securityLogger, getClientInfo } from './security-logger';
import rateLimit from 'express-rate-limit';

// Request schemas
const setupTwoFactorSchema = z.object({
  backupEmail: z.string().email().optional(),
});

const generateCodeSchema = z.object({
  type: z.enum(['login', 'enable_2fa', 'disable_2fa']),
});

const verifyCodeSchema = z.object({
  code: z.string().min(6).max(6),
  type: z.enum(['login', 'enable_2fa', 'disable_2fa']),
});

const updateSettingsSchema = z.object({
  backupEmail: z.string().email().optional(),
});

// Rate limiting for 2FA endpoints
const twoFactorRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit to 10 requests per window
  message: {
    error: "Too many 2FA requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const codeGenerationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit to 3 code generation requests per window
  message: {
    error: "Too many verification code requests. Please wait before requesting another."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

export function registerTwoFactorRoutes(app: Express): void {
  
  /**
   * GET /api/2fa/status
   * Get current 2FA status and settings for the authenticated user
   */
  app.get('/api/2fa/status', requireUserAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const settings = await twoFactorService.getSettings(userId);
      
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error('Error getting 2FA status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * POST /api/2fa/generate-code
   * Generate and send a 2FA verification code
   */
  app.post('/api/2fa/generate-code', 
    requireUserAuth, 
    codeGenerationRateLimit, 
    async (req: any, res: Response) => {
      try {
        const userId = req.user.id;
        const { type } = generateCodeSchema.parse(req.body);

        const result = await twoFactorService.generateAndSendCode(userId, type, {}, req);

        if (result.success) {
          res.json({
            success: true,
            message: result.message,
            codeId: result.codeId,
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.message,
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          });
        }

        console.error('Error generating 2FA code:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * POST /api/2fa/verify-code
   * Verify a 2FA code
   */
  app.post('/api/2fa/verify-code', 
    requireUserAuth, 
    twoFactorRateLimit, 
    async (req: any, res: Response) => {
      try {
        const userId = req.user.id;
        const { code, type } = verifyCodeSchema.parse(req.body);

        const result = await twoFactorService.verifyCode(userId, code, type, req);

        if (result.success) {
          res.json({
            success: true,
            message: result.message,
            codeId: result.codeId,
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.message,
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          });
        }

        console.error('Error verifying 2FA code:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * POST /api/2fa/enable
   * Enable 2FA for the authenticated user
   * Requires verification code
   */
  app.post('/api/2fa/enable', 
    requireUserAuth, 
    twoFactorRateLimit, 
    async (req: any, res: Response) => {
      try {
        const userId = req.user.id;
        const { code, backupEmail } = z.object({
          code: z.string().min(6).max(6),
          backupEmail: z.string().email().optional(),
        }).parse(req.body);

        // First verify the enable_2fa code
        const verifyResult = await twoFactorService.verifyCode(userId, code, 'enable_2fa', req);
        
        if (!verifyResult.success) {
          return res.status(400).json({
            success: false,
            error: verifyResult.message,
          });
        }

        // Enable 2FA
        const enableResult = await twoFactorService.enableTwoFactor(userId, backupEmail);

        if (enableResult.success) {
          const { ip, userAgent } = getClientInfo(req);
          securityLogger.logSecurityEvent({
            eventType: "TWO_FACTOR_ENABLED" as any,
            severity: "HIGH" as any,
            message: `Two-factor authentication enabled`,
            ip,
            userAgent,
            endpoint: req.path,
            details: { userId, hasBackupEmail: !!backupEmail }
          });

          res.json({
            success: true,
            message: enableResult.message,
          });
        } else {
          res.status(500).json({
            success: false,
            error: enableResult.message,
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          });
        }

        console.error('Error enabling 2FA:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * POST /api/2fa/disable
   * Disable 2FA for the authenticated user
   * Requires verification code
   */
  app.post('/api/2fa/disable', 
    requireUserAuth, 
    twoFactorRateLimit, 
    async (req: any, res: Response) => {
      try {
        const userId = req.user.id;
        const { code } = z.object({
          code: z.string().min(6).max(6),
        }).parse(req.body);

        // First verify the disable_2fa code
        const verifyResult = await twoFactorService.verifyCode(userId, code, 'disable_2fa', req);
        
        if (!verifyResult.success) {
          return res.status(400).json({
            success: false,
            error: verifyResult.message,
          });
        }

        // Disable 2FA
        const disableResult = await twoFactorService.disableTwoFactor(userId);

        if (disableResult.success) {
          const { ip, userAgent } = getClientInfo(req);
          securityLogger.logSecurityEvent({
            eventType: "TWO_FACTOR_DISABLED" as any,
            severity: "HIGH" as any,
            message: `Two-factor authentication disabled`,
            ip,
            userAgent,
            endpoint: req.path,
            details: { userId }
          });

          res.json({
            success: true,
            message: disableResult.message,
          });
        } else {
          res.status(500).json({
            success: false,
            error: disableResult.message,
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          });
        }

        console.error('Error disabling 2FA:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * PUT /api/2fa/settings
   * Update 2FA settings (backup email)
   */
  app.put('/api/2fa/settings', 
    requireUserAuth, 
    twoFactorRateLimit, 
    async (req: any, res: Response) => {
      try {
        const userId = req.user.id;
        const { backupEmail } = updateSettingsSchema.parse(req.body);

        // Check if 2FA is enabled
        const isEnabled = await twoFactorService.isEnabled(userId);
        if (!isEnabled) {
          return res.status(400).json({
            success: false,
            error: 'Two-factor authentication must be enabled to update settings',
          });
        }

        // Update backup email (we reuse the enableTwoFactor method which updates backup email)
        const result = await twoFactorService.enableTwoFactor(userId, backupEmail);

        if (result.success) {
          const { ip, userAgent } = getClientInfo(req);
          securityLogger.logSecurityEvent({
            eventType: "TWO_FACTOR_SETTINGS_UPDATED" as any,
            severity: "MEDIUM" as any,
            message: `2FA settings updated`,
            ip,
            userAgent,
            endpoint: req.path,
            details: { userId, backupEmailSet: !!backupEmail }
          });

          res.json({
            success: true,
            message: '2FA settings updated successfully',
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Failed to update 2FA settings',
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          });
        }

        console.error('Error updating 2FA settings:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * DELETE /api/2fa/cleanup
   * Admin endpoint to clean up expired 2FA codes
   */
  app.delete('/api/2fa/cleanup', requireAdminAuth, async (req: any, res: Response) => {
    try {
      const cleanedCount = await twoFactorService.cleanupExpired();
      
      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "ADMIN_ACTION" as any,
        severity: "LOW" as any,
        message: `2FA cleanup performed`,
        ip,
        userAgent,
        endpoint: req.path,
        details: { cleanedCodes: cleanedCount }
      });

      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired 2FA codes`,
        cleanedCount,
      });
    } catch (error) {
      console.error('Error cleaning up 2FA codes:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/2fa/stats (Admin only)
   * Get 2FA statistics
   */
  app.get('/api/2fa/stats', requireAdminAuth, async (req: any, res: Response) => {
    try {
      // This would require additional database queries
      // For now, return basic info
      res.json({
        success: true,
        message: '2FA statistics endpoint - implementation pending',
        data: {
          note: 'Full statistics implementation pending'
        }
      });
    } catch (error) {
      console.error('Error getting 2FA stats:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  console.log('✅ Two-Factor Authentication routes registered');
}