import { Express, Request, Response, NextFunction } from "express";
import { databaseStorage } from "./storage";
import { insertUserSchema, insertUserSubscriptionSchema, insertUsageRecordSchema } from "@shared/schema";
import { z } from "zod";
import { generateJWT, optionalUserAuth, requireUserAuth } from "./auth";
import { securityLogger, SecurityEventType, SecuritySeverity } from "./security-logger";
import { hashPassword, verifyPassword, createPseudonymizedEmail, verifyEmailMatch } from "./argon2";
import { accountDeletionService } from "./account-deletion-service";
import { twoFactorService } from "./two-factor-service";

/**
 * Find user by email using deterministic hash entanglement
 * Shared utility for consistent email lookup across endpoints
 */
async function findUserByEmailWithEntanglement(email: string): Promise<any> {
  console.log(`🔍 [User Routes] Looking up user for email: ${email}`);
  
  // First try direct lookup
  let user = await databaseStorage.getUserByEmail(email);
  if (user) {
    console.log(`✅ [User Routes] Found user by direct email lookup`);
    return user;
  }
  
  // If not found and email doesn't look pseudonymized, create pseudonym and try lookup
  if (!email.includes('@subscription.internalusers.email')) {
    try {
      const pseudonymizedEmail = await createPseudonymizedEmail(email);
      console.log(`🔗 [User Routes] Generated pseudonym: ${email} -> ${pseudonymizedEmail}`);
      
      user = await databaseStorage.getUserByEmail(pseudonymizedEmail);
      if (user) {
        console.log(`✅ [User Routes] Found user by pseudonymized email lookup`);
        return user;
      }
    } catch (error) {
      console.error('❌ [User Routes] Failed to create pseudonymized email for lookup:', error);
    }
  }
  
  console.log(`❌ [User Routes] No user found for email: ${email}`);
  return null;
}

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  twoFactorCode: z.string().length(6).optional(), // Optional 2FA code
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(8),
}).omit({ hashedPassword: true });

const subscriptionSchema = z.object({
  tierId: z.string(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
});

const accountDeletionSchema = z.object({
  confirmEmail: z.string().email(),
  reason: z.enum(['user_request', 'admin_action', 'compliance']).optional().default('user_request'),
  retainFinancialData: z.boolean().optional().default(true),
  anonymizeData: z.boolean().optional().default(true),
});

export function registerUserRoutes(app: Express) {
  // User registration
  app.post("/api/users/register", async (req: Request, res: Response) => {
    try {
      const userData = registerSchema.parse(req.body);

      // Check if user already exists (using entanglement to handle real/pseudo emails)
      const existingUser = await findUserByEmailWithEntanglement(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password with Argon2id
      const hashedPassword = await hashPassword(userData.password as string);

      // Create user
      const user = await databaseStorage.createUser({
        ...userData,
        hashedPassword,
      });

      // Generate JWT token for new user
      const token = generateJWT(user.id);

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      res.status(201).json({
        user: userResponse,
        token
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // User login
  app.post("/api/users/login", async (req: Request, res: Response) => {
    try {
      const { email, password, twoFactorCode } = loginSchema.parse(req.body);
      const ip = req.ip || req.socket.remoteAddress as string;
      const userAgent = req.get('User-Agent') || 'unknown';

      // Find user using deterministic hash entanglement
      const user = await findUserByEmailWithEntanglement(email);
      
      if (!user || !user.hashedPassword) {
        securityLogger.logFailedAuth(ip, userAgent, `User not found: ${email}`, '/api/login');
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password with Argon2id
      let isValidPassword = await verifyPassword(password, user.hashedPassword);
      let needsPasswordMigration = false;

      // Check if it's a legacy bcrypt password that needs migration
      if (!isValidPassword && (user.hashedPassword.startsWith('$2b$') || 
                              user.hashedPassword.startsWith('$2a$') || 
                              user.hashedPassword.startsWith('$2y$'))) {
        try {
          const bcrypt = await import('bcrypt');
          isValidPassword = await bcrypt.compare(password, user.hashedPassword);
          needsPasswordMigration = isValidPassword;
        } catch (error) {
          console.error('Legacy bcrypt verification failed:', error);
        }
      }

      if (!isValidPassword) {
        securityLogger.logFailedAuth(ip, userAgent, `Invalid password for ${email}`, '/api/login');
        return res.status(401).json({
          error: "Invalid email or password"
        });
      }

      // Migrate legacy bcrypt password to Argon2id
      if (needsPasswordMigration) {
        try {
          console.log(`🔄 Migrating password for user ${email} from bcrypt to Argon2id`);
          const newHashedPassword = await hashPassword(password);
          await databaseStorage.updateUser(user.id, { hashedPassword: newHashedPassword });
          console.log(`✅ Password migration completed for user ${email}`);
        } catch (error) {
          console.error(`❌ Password migration failed for user ${email}:`, error);
          // Continue with login even if migration fails
        }
      }

      // Check if user has 2FA enabled
      const hasTwoFactorEnabled = await twoFactorService.isEnabled(user.id);

      if (hasTwoFactorEnabled) {
        // 2FA is enabled, check if code was provided
        if (!twoFactorCode) {
          // No 2FA code provided - send code and require it
          const codeResult = await twoFactorService.generateAndSendCode(
            user.id, 
            'login', 
            {}, 
            req
          );

          if (codeResult.success) {
            return res.status(202).json({
              requiresTwoFactor: true,
              message: codeResult.message,
              codeId: codeResult.codeId,
            });
          } else {
            return res.status(500).json({
              error: codeResult.message,
            });
          }
        } else {
          // 2FA code provided - verify it
          const verifyResult = await twoFactorService.verifyCode(
            user.id, 
            twoFactorCode, 
            'login', 
            req
          );

          if (!verifyResult.success) {
            securityLogger.logFailedAuth(ip, userAgent, `Invalid 2FA code for ${email}`, '/api/login');
            return res.status(401).json({
              error: verifyResult.message,
            });
          }

          // 2FA verification successful, log it
          securityLogger.logSecurityEvent({
            eventType: "TWO_FACTOR_LOGIN_SUCCESS" as any,
            severity: "LOW" as any,
            message: `Successful 2FA login for ${email}`,
            ip,
            userAgent,
            endpoint: '/api/users/login',
            details: { userId: user.id, email }
          });
        }
      }

      // Update last login timestamp
      try {
        await databaseStorage.updateUser(user.id, { lastLoginAt: new Date() });
      } catch (error) {
        console.error('Failed to update last login timestamp:', error);
        // Don't fail login if this fails
      }

      // Generate JWT token for logged-in user
      const token = generateJWT(user.id);

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      
      securityLogger.logSecurityEvent({
        eventType: "LOGIN_SUCCESS" as any,
        severity: "LOW" as any,
        message: `Successful login for ${email}`,
        ip,
        userAgent,
        endpoint: '/api/users/login',
        details: { userId: user.id, email, twoFactorUsed: hasTwoFactorEnabled }
      });

      res.json({
        user: userResponse,
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Validate subscription token
  app.post("/api/users/validate-token", async (req: Request, res: Response) => {
    try {
      const token = req.headers['x-subscription-token'] as string;
      
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      // Use hybrid token service for validation (supports both JOSE and PostgreSQL)
      const { hybridTokenService } = await import("./hybrid-token-service");
      
      try {
        // Debug: Log the incoming token for troubleshooting
        console.log(`🔍 Validating token: ${token.slice(0, 50)}... (length: ${token.length})`);
        
        // Try to get token info from hybrid service (supports both JOSE and PostgreSQL)
        const tokenData = await hybridTokenService.validateSubscriptionToken(token);
        
        console.log(`🔍 Token validation result:`, tokenData ? 'SUCCESS' : 'FAILED');
        if (tokenData) {
          console.log(`🔍 Token data: userId=${tokenData.userId}, tierId=${tokenData.tierId}`);
        }
        
        if (!tokenData) {
          console.log(`❌ Token validation failed for: ${token.slice(0, 20)}...`);
          return res.status(401).json({ error: "Invalid token" });
        }

        // Check if token is expired (this is already handled in validateSubscriptionToken method)
        if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
          return res.status(401).json({ error: "Token expired" });
        }

        // Update token usage (only for PostgreSQL tokens)
        await hybridTokenService.updateTokenUsage(token);

        // Get user details to include email in response
        const user = await databaseStorage.getUser(tokenData.userId);
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }

        // Token is valid
        res.json({ 
          valid: true, 
          userId: tokenData.userId,
          tierId: tokenData.tierId,
          email: user.email
        });
      } catch (error) {
        console.error("Token validation error:", error);
        return res.status(401).json({ error: "Invalid token" });
      }
    } catch (error) {
      console.error("Validate token error:", error);
      res.status(500).json({ error: "Token validation failed" });
    }
  });

  // Get user profile
  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await databaseStorage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      res.json({ user: userResponse });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Update user profile
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const updates = insertUserSchema.partial().parse(req.body);

      const user = await databaseStorage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      res.json({ user: userResponse });
    } catch (error) {
      console.error("Update user error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Get user subscription
  app.get("/api/users/:id/subscription", async (req: Request, res: Response) => {
    try {
      const subscription = await databaseStorage.getUserSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "No subscription found" });
      }

      res.json({ subscription });
    } catch (error) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: "Failed to get subscription" });
    }
  });

  // Create user subscription
  app.post("/api/users/:id/subscription", async (req: Request, res: Response) => {
    try {
      const subscriptionData = subscriptionSchema.parse(req.body);

      const subscription = await databaseStorage.createUserSubscription({
        userId: req.params.id,
        ...subscriptionData,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cancelAtPeriodEnd: false,
      });

      res.status(201).json({ subscription });
    } catch (error) {
      console.error("Create subscription error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Update user subscription
  app.patch("/api/users/:id/subscription/:subscriptionId", async (req: Request, res: Response) => {
    try {
      const updates = insertUserSubscriptionSchema.partial().parse(req.body);

      const subscription = await databaseStorage.updateUserSubscription(req.params.subscriptionId, updates);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      res.json({ subscription });
    } catch (error) {
      console.error("Update subscription error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  // Cancel user subscription
  app.delete("/api/users/:id/subscription/:subscriptionId", async (req: Request, res: Response) => {
    try {
      const subscription = await databaseStorage.cancelUserSubscription(req.params.subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      res.json({ subscription });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Get user usage
  app.get("/api/users/:id/usage", async (req: Request, res: Response) => {
    try {
      const period = req.query.period as string || new Date().toISOString().slice(0, 7); // YYYY-MM format

      const usage = await databaseStorage.getUserUsage(req.params.id, period);
      if (!usage) {
        return res.status(404).json({ error: "No usage data found" });
      }

      res.json({ usage });
    } catch (error) {
      console.error("Get usage error:", error);
      res.status(500).json({ error: "Failed to get usage data" });
    }
  });

  // Get user usage history
  app.get("/api/users/:id/usage/history", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 12;

      const history = await databaseStorage.getUserUsageHistory(req.params.id, limit);
      res.json({ history });
    } catch (error) {
      console.error("Get usage history error:", error);
      res.status(500).json({ error: "Failed to get usage history" });
    }
  });

  // Track usage (for internal use)
  app.post("/api/users/:id/usage", async (req: Request, res: Response) => {
    try {
      const usageData = insertUsageRecordSchema.parse(req.body);

      const usage = await databaseStorage.createUsageRecord({
        ...usageData,
        userId: req.params.id, // Override userId from params
      });

      res.status(201).json({ usage });
    } catch (error) {
      console.error("Track usage error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to track usage" });
    }
  });

  // Delete user account (authenticated users only)
  app.delete("/api/users/account", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const deletionRequest = accountDeletionSchema.parse(req.body);
      const userId = (req as any).user.id;

      // Get user to verify email matches
      const user = await databaseStorage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify email confirmation
      if (user.email !== deletionRequest.confirmEmail) {
        await securityLogger.logSecurityEvent({
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecuritySeverity.MEDIUM,
          message: "Account deletion attempted with wrong email confirmation",
          ip: req.ip || "unknown",
          userAgent: req.get("User-Agent") || "unknown",
          endpoint: "/api/users/account",
          details: { 
            userId,
            providedEmail: deletionRequest.confirmEmail,
            actualEmail: user.email 
          }
        });
        return res.status(400).json({ error: "Email confirmation does not match account email" });
      }

      // Log account deletion request
      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ACCOUNT_ACTIVITY,
        severity: SecuritySeverity.HIGH,
        message: `User requested account deletion: ${user.email}`,
        ip: req.ip || "unknown",
        userAgent: req.get("User-Agent") || "unknown",
        endpoint: "/api/users/account",
        details: { 
          userId,
          reason: deletionRequest.reason,
          retainFinancialData: deletionRequest.retainFinancialData,
          anonymizeData: deletionRequest.anonymizeData
        }
      });

      // Perform account deletion
      const result = await accountDeletionService.deleteAccount({
        userId,
        reason: deletionRequest.reason,
        retainFinancialData: deletionRequest.retainFinancialData,
        anonymizeData: deletionRequest.anonymizeData,
      });

      if (result.success) {
        // Log successful deletion
        await securityLogger.logSecurityEvent({
          eventType: SecurityEventType.ACCOUNT_ACTIVITY,
          severity: SecuritySeverity.HIGH,
          message: `Account successfully deleted: ${user.email}`,
          ip: req.ip || "unknown",
          userAgent: req.get("User-Agent") || "unknown",
          endpoint: "/api/users/account",
          details: { 
            userId,
            deletedAt: result.deletedAt,
            anonymizedEmail: result.anonymizedEmail,
            stripeCustomerStatus: result.stripeCustomerStatus,
            retainedData: result.retainedData
          }
        });

        res.json({
          success: true,
          message: "Account successfully deleted",
          deletedAt: result.deletedAt,
          dataRetention: result.retainedData,
        });
      } else {
        res.status(500).json({
          error: "Failed to delete account",
          message: result.error
        });
      }
    } catch (error) {
      console.error("Account deletion error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Get account deletion status (authenticated users only)
  app.get("/api/users/account/deletion-status", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const status = await accountDeletionService.getDeletionStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Get deletion status error:", error);
      res.status(500).json({ error: "Failed to get deletion status" });
    }
  });

  // Admin: Restore deleted account
  app.post("/api/admin/users/:id/restore", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      
      // Check if current user is admin (this should be enhanced with proper admin auth)
      if (!currentUser.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const userId = req.params.id;
      const result = await accountDeletionService.restoreAccount(userId);

      if (result.success) {
        await securityLogger.logSecurityEvent({
          eventType: SecurityEventType.ADMIN_ACTION,
          severity: SecuritySeverity.HIGH,
          message: `Admin restored deleted account: ${userId}`,
          ip: req.ip || "unknown",
          userAgent: req.get("User-Agent") || "unknown",
          endpoint: `/api/admin/users/${userId}/restore`,
          details: { 
            userId: currentUser.id,
            restoredUserId: userId 
          }
        });

        res.json({ success: true, message: "Account restored successfully" });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Account restoration error:", error);
      res.status(500).json({ error: "Failed to restore account" });
    }
  });

  /**
   * Download user data (GDPR compliance)
   * Provides complete audit trail and personal data export
   */
  app.get("/api/users/me/download-data", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const ip = req.ip || req.socket.remoteAddress as string;
      const userAgent = req.get('User-Agent') || 'unknown';
      
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      console.log(`📥 User data download requested for user: ${userId}`);
      
      // Get user basic information
      const user = await databaseStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get subscription data
      const subscription = await databaseStorage.getUserSubscription(userId);
      
      // Get usage history
      const usageHistory = await databaseStorage.getUserUsageHistory(userId, 24); // Last 24 months
      
      // Get email change requests
      const emailRequests = await databaseStorage.getUserPendingEmailChangeRequests(userId);
      
      // Get security events for this user
      const userSecurityEvents = securityLogger.getRecentEvents(1000)
        .filter(event => {
          // Filter events related to this user
          return event.details?.userId === userId || 
                 event.ip === ip ||
                 (event.details?.sessionId && req.headers['x-session-id'] === event.details.sessionId);
        })
        .slice(0, 500); // Limit to last 500 events
      
      // Prepare comprehensive data export
      const exportData = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          exportedBy: user.email,
          dataTypes: ['profile', 'subscription', 'usage', 'security_events', 'email_requests'],
          complianceNote: 'This export contains all personal data associated with your account as per GDPR Article 15 (Right of Access)'
        },
        personalData: {
          profile: {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
            // Note: hashedPassword excluded for security
            stripeCustomerId: user.stripeCustomerId
          },
          subscription: subscription ? {
            id: subscription.id,
            tierId: subscription.tierId,
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt
          } : null,
          usageHistory: usageHistory.map(usage => ({
            period: usage.period,
            documentsAnalyzed: usage.documentsAnalyzed,
            tokensUsed: usage.tokensUsed,
            cost: usage.cost,
            createdAt: usage.createdAt
          })),
          emailChangeRequests: emailRequests.map(request => ({
            id: request.id,
            currentEmail: request.currentEmail,
            newEmail: request.newEmail,
            status: request.status,
            submittedAt: request.createdAt,
            reviewedAt: request.reviewedAt,
            reviewNotes: request.adminNotes
          })),
          securityEvents: userSecurityEvents.map(event => ({
            timestamp: event.timestamp,
            type: event.eventType,
            severity: event.severity,
            message: event.message,
            endpoint: event.endpoint,
            // Note: IP addresses are hashed for privacy
            ipHash: event.ip,
            userAgent: event.userAgent,
            details: event.details
          }))
        },
        legalInformation: {
          dataController: 'ReadMyFinePrint',
          contactEmail: 'privacy@readmyfineprint.com',
          dataRetentionPolicy: 'Personal data is retained for the duration of your subscription plus 7 years for legal and accounting purposes.',
          yourRights: [
            'Right to Access (Article 15) - This export',
            'Right to Rectification (Article 16) - Contact support to correct data',
            'Right to Erasure (Article 17) - Request account deletion',
            'Right to Restrict Processing (Article 18) - Contact support',
            'Right to Data Portability (Article 20) - This export provides portable data',
            'Right to Object (Article 21) - Contact support or unsubscribe'
          ],
          lawfulBasis: 'Processing is based on contract performance (Article 6(1)(b)) and legitimate interests (Article 6(1)(f))'
        }
      };
      
      // Log the data export for audit purposes
      securityLogger.logSecurityEvent({
        eventType: 'DATA_EXPORT' as any,
        severity: 'MEDIUM' as any,
        message: `User data export completed for user ${userId}`,
        ip,
        userAgent,
        endpoint: '/api/users/me/download-data',
        details: {
          userId,
          exportSize: JSON.stringify(exportData).length,
          dataTypes: exportData.exportInfo.dataTypes,
          securityEventsCount: userSecurityEvents.length,
          usageRecordsCount: usageHistory.length
        }
      });
      
      // Set headers for file download
      const filename = `readmyfineprint-data-export-${user.id}-${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Export-Date', new Date().toISOString());
      res.setHeader('X-Data-Types', exportData.exportInfo.dataTypes.join(','));
      
      res.json(exportData);
      
    } catch (error) {
      console.error("User data download error:", error);
      res.status(500).json({ error: "Failed to generate data export" });
    }
  });
}