import { Express, Request, Response } from "express";
import { requireAdminAuth, requireAdminViaSubscription } from "./auth";
import { databaseStorage } from "./storage";
import { securityLogger, SecurityEventType, SecuritySeverity, getClientInfo } from "./security-logger";
import { emailRecoveryService } from "./email-recovery-service";
import { priorityQueue } from "./priority-queue";
import { adminVerificationService } from "./admin-verification";
import { SUBSCRIPTION_TIERS } from "./subscription-tiers";
import { hashPassword } from "./argon2";
import { z } from "zod";
import Stripe from 'stripe';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

/**
 * Translate pseudonymized emails to real emails for admin access
 * Uses Stripe customer lookup for users with subscriptions
 */
async function translateEmailsForAdmin(users: any[]): Promise<any[]> {
  const translatedUsers = await Promise.all(users.map(async (user) => {
    // Check if email is pseudonymized (contains @subscription.internalusers.email)
    if (user.email && user.email.includes('@subscription.internalusers.email')) {
      try {
        // Try to get real email from Stripe using stripeCustomerId
        if (user.stripeCustomerId) {
          const customer = await stripe.customers.retrieve(user.stripeCustomerId);
          if (customer && !customer.deleted && typeof customer.email === 'string') {
            console.log(`📧 Translated ${user.email} -> ${customer.email} for admin view`);
            return {
              ...user,
              email: customer.email, // Use real email from Stripe
              pseudonymizedEmail: user.email // Keep pseudonym for reference
            };
          }
        }
        
        // If no Stripe customer or failed lookup, mark as pseudonymized
        return {
          ...user,
          email: `[PSEUDONYMIZED] ${user.email}`,
          pseudonymizedEmail: user.email
        };
      } catch (error) {
        console.error(`Failed to lookup real email for user ${user.id}:`, error);
        return {
          ...user,
          email: `[LOOKUP_FAILED] ${user.email}`,
          pseudonymizedEmail: user.email
        };
      }
    }
    
    // Return user as-is if not pseudonymized
    return user;
  }));
  
  return translatedUsers;
}

export function registerAdminRoutes(app: Express) {

  /**
   * Request admin verification code - protected endpoint
   */
  app.post("/api/admin/request-verification", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const result = await adminVerificationService.sendAdminVerificationCode(ip, userAgent);

      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(429).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error("Admin verification request error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  /**
   * Verify admin code and get access token
   */
  app.post("/api/admin/verify-code", async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!code) {
        return res.status(400).json({ error: "Verification code is required" });
      }

      const result = await adminVerificationService.verifyAdminCode(code, ip, userAgent);

      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message,
          adminToken: result.token 
        });
      } else {
        res.status(401).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error("Admin verification error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  /**
   * Admin logout - revoke admin token
   */
  app.post("/api/admin/logout", async (req: Request, res: Response) => {
    try {
      const adminToken = req.headers['x-admin-token'] as string;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!adminToken) {
        return res.status(400).json({ error: "Admin token is required" });
      }

      const revoked = adminVerificationService.revokeAdminToken(adminToken);
      
      if (revoked) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.LOW,
          message: 'Admin logged out successfully',
          ip,
          userAgent,
          endpoint: '/api/admin/logout'
        });

        res.json({ 
          success: true, 
          message: 'Admin logged out successfully' 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid token or already logged out' 
        });
      }
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  /**
   * Admin Metrics - Basic metrics only (subscription-based auth)
   */
  app.get("/api/admin/metrics-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      // Get basic metrics with individual error handling and fallbacks
      let totalUsers = 0;
      let activeSubscriptions = 0;
      let pendingEmailRequests = 0;
      let securityEvents = 0;
      let databaseAvailable = true;

      try {
        totalUsers = await databaseStorage.getTotalUserCount();
      } catch (error: any) {
        console.error("Failed to get total users:", error);
        if (error.message?.includes('terminating connection') || 
            error.cause?.message?.includes('terminating connection') ||
            error.code === '57P01') {
          databaseAvailable = false;
        }
      }

      try {
        activeSubscriptions = await databaseStorage.getActiveSubscriptionCount();
      } catch (error: any) {
        console.error("Failed to get active subscriptions:", error);
        if (error.message?.includes('terminating connection') || 
            error.cause?.message?.includes('terminating connection') ||
            error.code === '57P01') {
          databaseAvailable = false;
        }
      }

      try {
        const emailRequests = await emailRecoveryService.getPendingEmailChangeRequests(1000);
        pendingEmailRequests = emailRequests.length;
      } catch (error: any) {
        console.error("Failed to get pending email requests:", error);
        if (error.message?.includes('terminating connection') || 
            error.cause?.message?.includes('terminating connection') ||
            error.code === '57P01') {
          databaseAvailable = false;
        }
      }

      try {
        const securityStats = securityLogger.getSecurityStats();
        securityEvents = securityStats.last24Hours.total;
      } catch (error) {
        console.error("Failed to get security stats:", error);
        // Security stats are not database-dependent, so this shouldn't affect databaseAvailable
      }

      // If database is unavailable, provide a clear indication
      const response: any = {
        totalUsers,
        activeSubscriptions,
        pendingEmailRequests,
        securityEvents
      };

      if (!databaseAvailable) {
        response.databaseStatus = 'unavailable';
        response.note = 'Some metrics may be outdated due to database connectivity issues';
      }

      res.json(response);

    } catch (error) {
      console.error("Admin metrics error:", error);
      
      // Even if everything fails, provide a basic response
      res.json({
        totalUsers: 0,
        activeSubscriptions: 0,
        pendingEmailRequests: 0,
        securityEvents: 0,
        databaseStatus: 'error',
        error: 'Failed to load metrics data'
      });
    }
  });

  /**
   * Admin System Health - System status only (subscription-based auth)
   */
  app.get("/api/admin/system-health-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      // System health checks
      const memoryUsage = process.memoryUsage();
      const systemHealth = {
        database: await checkDatabaseHealth(),
        emailService: await checkEmailServiceHealth(),
        openaiService: await checkOpenAIServiceHealth(),
        priorityQueue: priorityQueue.getQueueStats(),
        memoryUsage: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external
        },
        uptime: process.uptime()
      };

      res.json(systemHealth);

    } catch (error) {
      console.error("Admin system health error:", error);
      res.status(500).json({ error: "Failed to load system health data" });
    }
  });

  /**
   * Admin Activity - Recent activity metrics only (subscription-based auth)
   */
  app.get("/api/admin/activity-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Recent activity metrics with error handling
      let newUsersLast24h = 0;
      let newUsersLast7d = 0;
      let activeSubscriptionsLast24h = 0;
      let documentsAnalyzedLast24h = 0;
      let documentsAnalyzedLast7d = 0;

      try {
        newUsersLast24h = await databaseStorage.getUserCountSince(last24h);
        newUsersLast7d = await databaseStorage.getUserCountSince(last7d);
        activeSubscriptionsLast24h = await databaseStorage.getSubscriptionCountSince(last24h);
        documentsAnalyzedLast24h = await databaseStorage.getDocumentAnalysisCountSince(last24h);
        documentsAnalyzedLast7d = await databaseStorage.getDocumentAnalysisCountSince(last7d);
      } catch (error) {
        console.error("Failed to get activity metrics:", error);
      }

      res.json({
        newUsersLast24h,
        newUsersLast7d,
        activeSubscriptionsLast24h,
        documentsAnalyzedLast24h,
        documentsAnalyzedLast7d
      });

    } catch (error) {
      console.error("Admin activity error:", error);
      res.status(500).json({ error: "Failed to load activity data" });
    }
  });

  /**
   * Admin Dashboard Overview - Key metrics and system status (subscription-based auth)
   * @deprecated Use separate endpoints for better performance
   */
  app.get("/api/admin/dashboard-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get basic metrics with individual error handling
      let totalUsers = 0;
      let activeSubscriptions = 0;
      let pendingEmailRequests = 0;
      let securityEvents = 0;

      try {
        totalUsers = await databaseStorage.getTotalUserCount();
      } catch (error) {
        console.error("Failed to get total users:", error);
      }

      try {
        activeSubscriptions = await databaseStorage.getActiveSubscriptionCount();
      } catch (error) {
        console.error("Failed to get active subscriptions:", error);
      }

      try {
        const emailRequests = await emailRecoveryService.getPendingEmailChangeRequests(1000);
        pendingEmailRequests = emailRequests.length;
      } catch (error) {
        console.error("Failed to get pending email requests:", error);
      }

      try {
        const securityStats = securityLogger.getSecurityStats();
        securityEvents = securityStats.last24Hours.total;
      } catch (error) {
        console.error("Failed to get security stats:", error);
      }

      // System health checks
      const memoryUsage = process.memoryUsage();
      const systemHealth = {
        database: await checkDatabaseHealth(),
        emailService: await checkEmailServiceHealth(),
        openaiService: await checkOpenAIServiceHealth(),
        priorityQueue: priorityQueue.getQueueStats(),
        memoryUsage: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external
        },
        uptime: process.uptime()
      };

      // Recent activity metrics with error handling
      let newUsersLast24h = 0;
      let newUsersLast7d = 0;
      let activeSubscriptionsLast24h = 0;
      let documentsAnalyzedLast24h = 0;
      let documentsAnalyzedLast7d = 0;

      try {
        newUsersLast24h = await databaseStorage.getUserCountSince(last24h);
        newUsersLast7d = await databaseStorage.getUserCountSince(last7d);
        activeSubscriptionsLast24h = await databaseStorage.getSubscriptionCountSince(last24h);
        documentsAnalyzedLast24h = await databaseStorage.getDocumentAnalysisCountSince(last24h);
        documentsAnalyzedLast7d = await databaseStorage.getDocumentAnalysisCountSince(last7d);
      } catch (error) {
        console.error("Failed to get activity metrics:", error);
      }

      const recentActivity = {
        newUsersLast24h,
        newUsersLast7d,
        activeSubscriptionsLast24h,
        documentsAnalyzedLast24h,
        documentsAnalyzedLast7d
      };

      res.json({
        metrics: {
          totalUsers,
          activeSubscriptions,
          pendingEmailRequests,
          securityEvents
        },
        systemHealth,
        recentActivity
      });

    } catch (error) {
      console.error("Admin dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  });

  /**
   * User Management - Get users with search and filtering (subscription-based auth)
   */
  app.get("/api/admin/users-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      const hasSubscription = req.query.hasSubscription as string;

      const users = await databaseStorage.getUsers({
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        hasSubscription: hasSubscription === 'true' ? true : hasSubscription === 'false' ? false : undefined
      });

      // Translate pseudonymized emails to real emails for admin access
      const translatedUsers = await translateEmailsForAdmin(users.users);
      
      const result = {
        ...users,
        users: translatedUsers
      };

      res.json(result);

    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  /**
   * User Management - Get users with search and filtering (original admin auth)
   */
  app.get("/api/admin/users", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      const hasSubscription = req.query.hasSubscription as string;

      const users = await databaseStorage.getUsers({
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        hasSubscription: hasSubscription === 'true' ? true : hasSubscription === 'false' ? false : undefined
      });

      // Translate pseudonymized emails to real emails for admin access
      const translatedUsers = await translateEmailsForAdmin(users.users);
      
      const result = {
        ...users,
        users: translatedUsers
      };

      res.json(result);

    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  /**
   * User Details - Get detailed user information
   */
  app.get("/api/admin/users/:userId", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const [user, subscription, usageHistory, emailRequests] = await Promise.all([
        databaseStorage.getUser(userId),
        databaseStorage.getUserSubscription(userId),
        databaseStorage.getUserUsageHistory(userId, 6), // Last 6 months
        databaseStorage.getUserPendingEmailChangeRequests(userId)
      ]);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get user's recent security events
      const recentEvents = securityLogger.getRecentEvents(100)
        .filter(event => event.details?.userId === userId)
        .slice(0, 20);

      // Translate user email if pseudonymized
      const translatedUsers = await translateEmailsForAdmin([user]);
      const translatedUser = translatedUsers[0];

      res.json({
        user: {
          ...translatedUser,
          hashedPassword: undefined // Don't send password hash
        },
        subscription,
        usageHistory,
        emailRequests,
        recentSecurityEvents: recentEvents
      });

    } catch (error) {
      console.error("Get user details error:", error);
      res.status(500).json({ error: "Failed to get user details" });
    }
  });

  /**
   * Update User - Admin can modify user details (subscription-based auth)
   */
  app.patch("/api/admin/users-subscription/:userId", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const updateSchema = z.object({
        email: z.string().email().optional(),
        // Add other updateable fields as needed
      });

      const updates = updateSchema.parse(req.body);
      
      const updatedUser = await databaseStorage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Log the admin action
      const adminId = (req as any).user?.id;
      securityLogger.logSuspiciousActivity(
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        `Admin ${adminId} updated user ${userId}`,
        { adminId, targetUserId: userId, updates }
      );

      res.json({
        user: {
          ...updatedUser,
          hashedPassword: undefined
        }
      });

    } catch (error) {
      console.error("Update user error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  /**
   * Update User - Admin can modify user details (original admin auth)
   */
  app.patch("/api/admin/users/:userId", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const updateSchema = z.object({
        email: z.string().email().optional(),
        // Add other updateable fields as needed
      });

      const updates = updateSchema.parse(req.body);
      
      const updatedUser = await databaseStorage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Log the admin action
      const adminId = (req as any).user?.id;
      securityLogger.logSuspiciousActivity(
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        `Admin ${adminId} updated user ${userId}`,
        { adminId, targetUserId: userId, updates }
      );

      res.json({
        user: {
          ...updatedUser,
          hashedPassword: undefined
        }
      });

    } catch (error) {
      console.error("Update user error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  /**
   * Delete User - Admin can permanently delete users (subscription-based auth)
   */
  app.delete("/api/admin/users-subscription/:userId", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { confirmDelete, reason } = req.body;

      // Safety check - require explicit confirmation
      if (!confirmDelete) {
        return res.status(400).json({ 
          error: "User deletion requires explicit confirmation. Set confirmDelete: true" 
        });
      }

      // Get user details before deletion for logging
      const userToDelete = await databaseStorage.getUser(userId);
      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent deletion of admin users
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
      if (adminEmails.includes(userToDelete.email)) {
        return res.status(403).json({ 
          error: "Cannot delete admin users" 
        });
      }

      // Delete user and all associated data
      const deletionResult = await databaseStorage.deleteUser(userId, {
        includeSubscriptions: true,
        includeDocuments: true,
        includeSecurityEvents: true,
        reason: reason || 'Admin deletion'
      });

      // Log the admin action
      const adminId = (req as any).user?.id;
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.HIGH,
        message: `Admin ${adminId} deleted user ${userToDelete.email}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        details: {
          adminId,
          deletedUserId: userId,
          deletedUserEmail: userToDelete.email,
          reason: reason || 'No reason provided',
          deletionResult
        }
      });

      res.json({
        success: true,
        message: `User ${userToDelete.email} has been permanently deleted`,
        deletionDetails: deletionResult
      });

    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  /**
   * Suspend/Activate User - Admin can suspend or activate user accounts
   */
  app.patch("/api/admin/users-subscription/:userId/status", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { isActive, reason } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ 
          error: "isActive must be a boolean value" 
        });
      }

      const user = await databaseStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent suspension of admin users
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];
      if (adminEmails.includes(user.email) && !isActive) {
        return res.status(403).json({ 
          error: "Cannot suspend admin users" 
        });
      }

      const updatedUser = await databaseStorage.updateUser(userId, { 
        isActive,
        suspendedAt: isActive ? null : new Date(),
        suspensionReason: isActive ? null : reason
      });

      // Log the admin action
      const adminId = (req as any).user?.id;
      const action = isActive ? 'activated' : 'suspended';
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.MEDIUM,
        message: `Admin ${adminId} ${action} user ${user.email}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        details: {
          adminId,
          targetUserId: userId,
          targetUserEmail: user.email,
          action,
          reason: reason || 'No reason provided'
        }
      });

      res.json({
        success: true,
        message: `User ${user.email} has been ${action}`,
        user: {
          ...updatedUser,
          hashedPassword: undefined
        }
      });

    } catch (error) {
      console.error("Update user status error:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  /**
   * Reset User Password - Admin can force password reset
   */
  app.post("/api/admin/users-subscription/:userId/reset-password", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { sendEmail = true } = req.body;

      const user = await databaseStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate a secure temporary password
      const temporaryPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
      
      // Hash the temporary password
      const hashedPassword = await databaseStorage.hashPassword(temporaryPassword);
      
      // Update user with temporary password and force password change
      await databaseStorage.updateUser(userId, {
        hashedPassword,


      });

      // Log the admin action
      const adminId = (req as any).user?.id;
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.MEDIUM,
        message: `Admin ${adminId} reset password for user ${user.email}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        details: {
          adminId,
          targetUserId: userId,
          targetUserEmail: user.email,
          emailSent: sendEmail
        }
      });

      // Optionally send email with temporary password
      if (sendEmail) {
        try {
          // TODO: Implement email service integration
          console.log(`Would send temporary password ${temporaryPassword} to ${user.email}`);
        } catch (emailError) {
          console.error("Failed to send password reset email:", emailError);
        }
      }

      res.json({
        success: true,
        message: `Password reset for user ${user.email}`,
        temporaryPassword: sendEmail ? undefined : temporaryPassword, // Only return if not emailing
        mustChangePassword: true
      });

    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset user password" });
    }
  });

  /**
   * Manage User Subscription - Admin can modify user subscriptions
   */
  app.patch("/api/admin/users-subscription/:userId/subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { action, tierId, reason } = req.body;

      const validActions = ['cancel', 'reactivate', 'upgrade', 'downgrade', 'extend'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ 
          error: `Invalid action. Must be one of: ${validActions.join(', ')}` 
        });
      }

      const user = await databaseStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let result;
      const { subscriptionService } = await import("./subscription-service");

      switch (action) {
        case 'cancel':
          result = await subscriptionService.cancelSubscription(userId, reason);
          break;
        case 'reactivate':
          result = await subscriptionService.reactivateSubscription(userId);
          break;
        case 'upgrade':
        case 'downgrade':
          if (!tierId) {
            return res.status(400).json({ error: "tierId is required for upgrade/downgrade" });
          }
          result = await subscriptionService.updateSubscriptionTier(userId, tierId, reason);
          break;
        case 'extend':
          const { days = 30 } = req.body;
          result = await subscriptionService.extendSubscription(userId, days, reason);
          break;
      }

      // Log the admin action
      const adminId = (req as any).user?.id;
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.MEDIUM,
        message: `Admin ${adminId} ${action} subscription for user ${user.email}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        details: {
          adminId,
          targetUserId: userId,
          targetUserEmail: user.email,
          action,
          tierId,
          reason: reason || 'No reason provided',
          result
        }
      });

      res.json({
        success: true,
        message: `Subscription ${action} completed for user ${user.email}`,
        result
      });

    } catch (error) {
      console.error("Manage subscription error:", error);
      res.status(500).json({ error: "Failed to manage user subscription" });
    }
  });

  /**
   * Clear User Data - Admin can clear user documents and history
   */
  app.delete("/api/admin/users-subscription/:userId/data", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { dataTypes, reason } = req.body;

      const validDataTypes = ['documents', 'usage_history', 'security_events', 'sessions'];
      const typesToClear = dataTypes || ['documents', 'usage_history'];

      // Validate data types
      for (const type of typesToClear) {
        if (!validDataTypes.includes(type)) {
          return res.status(400).json({ 
            error: `Invalid data type: ${type}. Valid types: ${validDataTypes.join(', ')}` 
          });
        }
      }

      const user = await databaseStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const clearanceResults: Record<string, any> = {};

      for (const dataType of typesToClear) {
        try {
          switch (dataType) {
            case 'documents':
              clearanceResults[dataType] = await databaseStorage.clearUserDocuments(userId);
              break;
            case 'usage_history':
              clearanceResults[dataType] = await databaseStorage.clearUserUsageHistory(userId);
              break;
            case 'security_events':
              clearanceResults[dataType] = await databaseStorage.clearUserSecurityEvents(userId);
              break;
            case 'sessions':
              clearanceResults[dataType] = await databaseStorage.clearUserSessions(userId);
              break;
          }
        } catch (error) {
          clearanceResults[dataType] = { error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }

      // Log the admin action
      const adminId = (req as any).user?.id;
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.HIGH,
        message: `Admin ${adminId} cleared data for user ${user.email}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        details: {
          adminId,
          targetUserId: userId,
          targetUserEmail: user.email,
          dataTypesCleared: typesToClear,
          reason: reason || 'No reason provided',
          results: clearanceResults
        }
      });

      res.json({
        success: true,
        message: `Data cleared for user ${user.email}`,
        dataTypesCleared: typesToClear,
        results: clearanceResults
      });

    } catch (error) {
      console.error("Clear user data error:", error);
      res.status(500).json({ error: "Failed to clear user data" });
    }
  });

  /**
   * Bulk User Operations - Admin can perform operations on multiple users
   */
  app.post("/api/admin/users-subscription/bulk", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { userIds, operation, options = {} } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds must be a non-empty array" });
      }

      const validOperations = ['activate', 'suspend', 'delete', 'reset_password', 'clear_data'];
      if (!validOperations.includes(operation)) {
        return res.status(400).json({ 
          error: `Invalid operation. Must be one of: ${validOperations.join(', ')}` 
        });
      }

      // Limit bulk operations to prevent abuse
      if (userIds.length > 100) {
        return res.status(400).json({ error: "Bulk operations limited to 100 users at a time" });
      }

      const results = [];
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com', 'beatsbybuddha@gmail.com'];

      for (const userId of userIds) {
        try {
          const user = await databaseStorage.getUser(userId);
          if (!user) {
            results.push({ userId, success: false, error: "User not found" });
            continue;
          }

          // Prevent operations on admin users for sensitive operations
          if (adminEmails.includes(user.email) && ['suspend', 'delete'].includes(operation)) {
            results.push({ userId, success: false, error: "Cannot perform this operation on admin users" });
            continue;
          }

          let result;
          switch (operation) {
            case 'activate':
              result = await databaseStorage.updateUser(userId, { isActive: true, suspendedAt: null });
              break;
            case 'suspend':
              result = await databaseStorage.updateUser(userId, { 
                isActive: false, 
                suspendedAt: new Date(),
                suspensionReason: options.reason || 'Bulk suspension'
              });
              break;
            case 'delete':
              if (!options.confirmDelete) {
                results.push({ userId, success: false, error: "Delete operation requires confirmDelete: true" });
                continue;
              }
              result = await databaseStorage.deleteUser(userId, {
                includeSubscriptions: true,
                includeDocuments: true,
                reason: options.reason || 'Bulk deletion'
              });
              break;
            case 'reset_password':
              const tempPassword = crypto.randomBytes(8).toString('base64').slice(0, 12);
              const hashedPassword = await databaseStorage.hashPassword(tempPassword);
              result = await databaseStorage.updateUser(userId, {
                hashedPassword
              });
              if (result) {
                (result as any).temporaryPassword = tempPassword;
              }
              break;
            case 'clear_data':
              const dataTypes = options.dataTypes || ['documents'];
              result = {} as Record<string, any>;
              for (const dataType of dataTypes) {
                switch (dataType) {
                  case 'documents':
                    result.documents = await databaseStorage.clearUserDocuments(userId);
                    break;
                  case 'usage_history':
                    result.usage_history = await databaseStorage.clearUserUsageHistory(userId);
                    break;
                }
              }
              break;
          }

          results.push({ 
            userId, 
            email: user.email, 
            success: true, 
            result 
          });

        } catch (error) {
          results.push({ 
            userId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      // Log the bulk operation
      const adminId = (req as any).user?.id;
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.HIGH,
        message: `Admin ${adminId} performed bulk ${operation} on ${userIds.length} users`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        details: {
          adminId,
          operation,
          userCount: userIds.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
          options,
          results
        }
      });

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Bulk ${operation} completed: ${successCount} succeeded, ${failureCount} failed`,
        results,
        summary: {
          total: userIds.length,
          succeeded: successCount,
          failed: failureCount
        }
      });

    } catch (error) {
      console.error("Bulk user operation error:", error);
      res.status(500).json({ error: "Failed to perform bulk operation" });
    }
  });

  /**
   * Manual User Creation - Admin can create users manually with tier assignment
   */
  app.post("/api/admin/users-subscription/create", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { email, username, password, tierId, emailVerified = false, isActive = true } = req.body;
      
      // Validate required fields
      if (!email || !tierId) {
        return res.status(400).json({ 
          error: "Email and tier ID are required" 
        });
      }

      // Validate tier exists
      const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
      if (!tier) {
        return res.status(400).json({ 
          error: "Invalid tier ID" 
        });
      }

      // Check if user already exists
      const existingUser = await databaseStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          error: "User with this email already exists" 
        });
      }

      // Create user without password since system uses email verification
      const newUser = await databaseStorage.createUser({
        email,
        hashedPassword: null, // No password needed for email verification auth
        emailVerified,
        isActive
      });

      // Create subscription for the user
      const subscription = await databaseStorage.createUserSubscription({
        userId: newUser.id,
        tierId: tierId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        cancelAtPeriodEnd: false
      });

      // Send welcome email with credentials
      const { emailService } = await import('./email-service');
      await emailService.sendEmail({
        to: email,
        subject: 'Welcome to ReadMyFinePrint - Account Created',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to ReadMyFinePrint!</h2>
            
            <p>An administrator has created an account for you on ReadMyFinePrint.</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Account Details:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Subscription Tier:</strong> ${tier.name}</p>
            </div>
            
            <div style="background: #e8f5e8; border: 1px solid #4caf50; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #2e7d32;">🔐 How to Access Your Account</h4>
              <p style="margin: 0;">Your account uses secure email verification for login. Simply visit the login page and enter your email address to receive a verification code.</p>
            </div>
            
            <p>You can access your account at: <a href="${process.env.CLIENT_URL || 'https://readmyfineprint.com'}/login">ReadMyFinePrint Login</a></p>
            
            <h3>Your Subscription Includes:</h3>
            <ul>
              ${tier.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>The ReadMyFinePrint Team</p>
          </div>
        `
      });

      // Log the action
      securityLogger.logSecurityEvent({
        eventType: 'ADMIN_ACTION' as any,
        severity: 'MEDIUM' as any,
        message: `Admin manually created user account: ${email}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: '/api/admin/users-subscription/create',
        details: {
          adminUserId: (req as any).user?.id,
          createdUserId: newUser.id,
          email,
          tierId,
          emailVerified,
          isActive
        }
      });

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = newUser;

      res.status(201).json({
        success: true,
        user: userResponse,
        subscription,
        message: 'User created successfully and welcome email sent'
      });

    } catch (error) {
      console.error("Manual user creation error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  /**
   * System Health - Detailed system status
   */
  app.get("/api/admin/system-health", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const health = {
        timestamp: new Date(),
        services: {
          database: await checkDatabaseHealth(),
          emailService: await checkEmailServiceHealth(),
          openaiService: await checkOpenAIServiceHealth(),
          priorityQueue: priorityQueue.getQueueStats()
        },
        system: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          loadAverage: process.platform !== 'win32' && (process as any).loadavg ? (process as any).loadavg() : null,
          cpuUsage: process.cpuUsage()
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasOpenAI: !!process.env.OPENAI_API_KEY,
          hasStripe: !!process.env.STRIPE_SECRET_KEY,
          hasEmail: !!process.env.SMTP_USER
        }
      };

      res.json(health);

    } catch (error) {
      console.error("System health check error:", error);
      res.status(500).json({ error: "Failed to get system health" });
    }
  });

  /**
   * Security Events - Get recent security events with filtering (subscription-based auth)
   */
  app.get("/api/admin/security-events-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const severity = req.query.severity as string;
      const eventType = req.query.eventType as string;

      let events = securityLogger.getRecentEvents(limit);

      // Filter by severity if specified
      if (severity) {
        events = events.filter(event => event.severity === severity);
      }

      // Filter by event type if specified
      if (eventType) {
        events = events.filter(event => event.eventType === eventType);
      }

      res.json({
        events,
        stats: securityLogger.getSecurityStats()
      });

    } catch (error) {
      console.error("Get security events error:", error);
      res.status(500).json({ error: "Failed to get security events" });
    }
  });

  /**
   * Analytics - Subscription and usage analytics (subscription-based auth)
   */
  app.get("/api/admin/analytics-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const timeframe = req.query.timeframe as string || '30d';
      
      const analytics = await getAnalyticsData(timeframe);
      
      res.json(analytics);

    } catch (error) {
      console.error("Get analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics data" });
    }
  });

  /**
   * Configuration - Get system configuration
   */
  app.get("/api/admin/config", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const config = {
        subscriptionTiers: await databaseStorage.getSubscriptionTiers(),
        systemSettings: {
          maxUploadSize: '10MB', // From your file validation
          supportedFileTypes: ['pdf', 'docx', 'doc', 'txt'],
          sessionTimeout: '30 minutes',
          rateLimit: {
            emailRecovery: '3 requests per 24 hours',
            fileUpload: '10 files per hour',
            analysis: 'Based on subscription tier'
          }
        },
        features: {
          piiDetection: true,
          emailRecovery: true,
          subscriptionTiers: true,
          adminInterface: true
        }
      };

      res.json(config);

    } catch (error) {
      console.error("Get config error:", error);
      res.status(500).json({ error: "Failed to get configuration" });
    }
  });

  /**
   * Create Ultimate Tier Subscription for Admin (admin only)
   */
  app.post("/api/admin/create-ultimate-subscription", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const { ip, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Verify the requesting user is admin
      const requestingUserId = req.user?.id;
      if (!requestingUserId) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHORIZATION,
          severity: SecuritySeverity.HIGH,
          message: `Ultimate subscription creation attempted without user context`,
          ip,
          userAgent,
          endpoint: req.path,
          details: { targetUserId: userId }
        });
        return res.status(401).json({ error: "Authentication required" });
      }

      // Create ultimate subscription
      const { subscriptionService } = await import('./subscription-service');
      const ultimateSubscription = await subscriptionService.createAdminUltimateSubscription(userId);

      if (!ultimateSubscription) {
        return res.status(403).json({ 
          error: "Failed to create ultimate subscription. User may not be authorized for admin tier." 
        });
      }

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.MEDIUM,
        message: `Admin created ultimate subscription for user`,
        ip,
        userAgent,
        endpoint: req.path,
        details: {
          adminUserId: requestingUserId,
          targetUserId: userId,
          subscriptionId: ultimateSubscription.id,
          action: 'create_ultimate_subscription'
        }
      });

      res.json({
        success: true,
        message: "Ultimate tier subscription created successfully",
        subscription: {
          id: ultimateSubscription.id,
          userId: ultimateSubscription.userId,
          tierId: ultimateSubscription.tierId,
          status: ultimateSubscription.status,
          currentPeriodEnd: ultimateSubscription.currentPeriodEnd
        }
      });

    } catch (error) {
      console.error("Error creating ultimate subscription:", error);
      res.status(500).json({ 
        error: "Failed to create ultimate subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Law Enforcement Data Request - Requires admin authentication and verification
   * For complying with lawful requests from government agencies
   */
  app.post("/api/admin/law-enforcement-request", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as any).user?.id;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      if (!adminUserId) {
        return res.status(401).json({ error: "Admin user ID not found" });
      }

      // Validate request data
      const requestSchema = z.object({
        requestType: z.enum(['user_data', 'audit_logs', 'communication_records', 'financial_records']),
        targetIdentifier: z.string().min(1), // email, user ID, or other identifier
        legalBasis: z.string().min(10), // Court order number, warrant details, etc.
        requestingAgency: z.string().min(3),
        contactOfficer: z.string().min(3),
        urgencyLevel: z.enum(['routine', 'urgent', 'emergency']),
        dataScope: z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          includeDeleted: z.boolean().default(false),
          includeEncrypted: z.boolean().default(false)
        }).optional(),
        notes: z.string().optional()
      });

      const requestData = requestSchema.parse(req.body);
      
      // Generate unique request ID for tracking
      const requestId = crypto.randomUUID();
      
      console.log(`🏦 Law enforcement data request initiated: ${requestId}`);
      console.log(`   - Type: ${requestData.requestType}`);
      console.log(`   - Target: ${requestData.targetIdentifier}`);
      console.log(`   - Agency: ${requestData.requestingAgency}`);
      
      // Find target user
      const targetUser = await translateEmailsForAdmin([{ email: requestData.targetIdentifier }]).then(users => users[0]) || 
                         await databaseStorage.getUser(requestData.targetIdentifier);
      
      if (!targetUser) {
        return res.status(404).json({ 
          error: "Target user not found",
          requestId 
        });
      }

      console.log(`   - Target User ID: ${targetUser.id}`);
      
      // Security log for law enforcement request
      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.CRITICAL,
        message: "Law enforcement data request initiated",
        ip,
        userAgent,
        endpoint: "/api/admin/law-enforcement-request",
        details: {
          requestId,
          adminUserId,
          requestType: requestData.requestType,
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          requestingAgency: requestData.requestingAgency,
          legalBasis: requestData.legalBasis,
          urgencyLevel: requestData.urgencyLevel
        }
      });

      // Generate comprehensive data export based on request type
      let exportData: any = {
        requestId,
        generatedAt: new Date().toISOString(),
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          createdAt: targetUser.createdAt,
          isAdmin: targetUser.isAdmin,
          emailVerified: targetUser.emailVerified,
          isActive: targetUser.isActive,
          lastLoginAt: targetUser.lastLoginAt
        },
        requestDetails: requestData
      };

      try {
        switch (requestData.requestType) {
          case 'user_data':
            // Include subscription and usage data
            const subscription = await databaseStorage.getUserSubscription(targetUser.id);
            const usageRecords = subscription ? [subscription] : [];
            
            exportData.subscriptions = subscription;
            exportData.usageRecords = usageRecords;
            break;

          case 'audit_logs':
            // Include security events and admin actions related to user
            const securityEvents = await securityLogger.getSecurityEvents({
              limit: 1000,
              timeframe: 'all'
            });
            
            // Filter events related to target user
            const userRelatedEvents = securityEvents.events.filter(event => 
              event.userId === targetUser.id
            );

            exportData.securityEvents = {
              emailVerificationAttempts: securityEvents.events.filter(e => e.type === SecurityEventType.EMAIL_VERIFICATION),
              loginAttempts: securityEvents.events.filter(e => e.type === SecurityEventType.AUTHENTICATION)
            };
            break;

          case 'communication_records':
            // Include email change requests and verification records
            const emailChangeRequests = await databaseStorage.getUserPendingEmailChangeRequests(targetUser.id);
            exportData.emailChangeRequests = emailChangeRequests;
            break;

          case 'financial_records':
            // Include Stripe data if available
            if (targetUser.stripeCustomerId) {
              try {
                const stripeCustomer = await stripe.customers.retrieve(targetUser.stripeCustomerId);
                const charges = await stripe.charges.list({ customer: targetUser.stripeCustomerId });
                const invoices = await stripe.invoices.list({ customer: targetUser.stripeCustomerId });
                
                exportData.stripeData = {
                  customer: stripeCustomer,
                  charges: charges.data,
                  invoices: invoices.data
                };
              } catch (stripeError) {
                console.error('Failed to retrieve Stripe data:', stripeError);
                exportData.stripeDataError = 'Failed to retrieve financial records from payment processor';
              }
            }
            break;
        }

        console.log(`✅ Law enforcement data export generated: ${requestId}`);
        
        res.json({
          success: true,
          requestId,
          exportData,
          complianceNote: 'This data export is provided in response to a lawful request from law enforcement.'
        });

      } catch (dataError) {
        console.error(`❌ Failed to generate law enforcement data export: ${requestId}`, dataError);
        
        await securityLogger.logSecurityEvent({
          eventType: SecurityEventType.ERROR,
          severity: SecuritySeverity.HIGH,
          message: "Failed to generate law enforcement data export",
          ip,
          userAgent,
          endpoint: "/api/admin/law-enforcement-request",
          details: {
            requestId,
            adminUserId,
            targetUserId: targetUser.id,
            error: dataError instanceof Error ? dataError.message : 'Unknown error'
          }
        });

        res.status(500).json({ 
          error: "Failed to generate data export",
          requestId,
          details: dataError instanceof Error ? dataError.message : 'Unknown error'
        });
      }

    } catch (error) {
      console.error('❌ Law enforcement request validation failed:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: error.errors,
          requiredFields: [
            'requestType', 'targetIdentifier', 'legalBasis', 
            'requestingAgency', 'contactOfficer', 'urgencyLevel'
          ]
        });
      }
      
      res.status(500).json({ error: "Failed to process law enforcement request" });
    }
  });

}

// Helper functions for system health checks
async function checkDatabaseHealth(): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    await databaseStorage.getTotalUserCount();
    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (error: any) {
    // Check for specific database connection issues
    if (error.message?.includes('terminating connection') || 
        error.cause?.message?.includes('terminating connection') ||
        error.code === '57P01') {
      return { 
        status: 'connection_terminated', 
        error: 'Database connection was terminated (likely due to connection limits or maintenance)' 
      };
    }
    
    // Check for other connection issues
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { 
        status: 'connection_refused', 
        error: 'Cannot connect to database server' 
      };
    }
    
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}

async function checkEmailServiceHealth(): Promise<{ status: string; error?: string }> {
  try {
    // Check if email service is configured
    const hasEmailConfig = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    return { 
      status: hasEmailConfig ? 'healthy' : 'warning',
      error: hasEmailConfig ? undefined : 'SMTP not configured'
    };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function checkOpenAIServiceHealth(): Promise<{ status: string; error?: string }> {
  try {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    return { 
      status: hasOpenAIKey ? 'healthy' : 'warning',
      error: hasOpenAIKey ? undefined : 'OpenAI API key not configured'
    };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function getAnalyticsData(timeframe: string) {
  const now = new Date();
  let startDate: Date;

  switch (timeframe) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    const [userGrowth, subscriptionAnalytics, usageAnalytics, revenueAnalytics] = await Promise.all([
      databaseStorage.getUserGrowthData(startDate),
      databaseStorage.getSubscriptionAnalytics(startDate),
      databaseStorage.getUsageAnalytics(startDate),
      databaseStorage.getRevenueAnalytics(startDate)
    ]);

    return {
      userGrowth,
      subscriptionAnalytics,
      usageAnalytics,
      revenueAnalytics,
      timeframe,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    // Return default structure if database calls fail
    return {
      userGrowth: [],
      subscriptionAnalytics: {
        totalRevenue: 0,
        byTier: []
      },
      usageAnalytics: {
        totalDocuments: 0,
        totalTokens: 0,
        avgDocumentsPerUser: 0,
        byTier: []
      },
      revenueAnalytics: {
        totalRevenue: 0,
        byTier: [],
        growth: []
      },
      timeframe,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

}
