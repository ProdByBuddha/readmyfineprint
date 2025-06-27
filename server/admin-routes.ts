import { Express, Request, Response } from "express";
import { requireAdminAuth, requireAdminViaSubscription } from "./auth";
import { databaseStorage } from "./storage";
import { securityLogger, SecurityEventType, SecuritySeverity, getClientInfo } from "./security-logger";
import { emailRecoveryService } from "./email-recovery-service";
import { priorityQueue } from "./priority-queue";
import { adminVerificationService } from "./admin-verification";
import { z } from "zod";
import Stripe from 'stripe';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
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
        username: z.string().optional(),
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
        username: z.string().optional(),
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
