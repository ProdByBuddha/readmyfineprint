import { Express, Request, Response } from "express";
import { requireAdminAuth } from "./auth";
import { databaseStorage } from "./storage";
import { securityLogger } from "./security-logger";
import { emailRecoveryService } from "./email-recovery-service";
import { priorityQueue } from "./priority-queue";
import { adminVerificationService } from "./admin-verification";
import { z } from "zod";

export function registerAdminRoutes(app: Express) {

  /**
   * Request admin verification code
   */
  app.post("/api/admin/request-verification", async (req: Request, res: Response) => {
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
   * Admin Dashboard Overview - Key metrics and system status
   */
  app.get("/api/admin/dashboard", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get basic metrics
      const [
        totalUsers,
        activeSubscriptions,
        pendingEmailRequests,
        securityStats
      ] = await Promise.all([
        databaseStorage.getTotalUserCount(),
        databaseStorage.getActiveSubscriptionCount(),
        emailRecoveryService.getPendingEmailChangeRequests(1000), // Get all for count
        securityLogger.getSecurityStats()
      ]);

      // System health checks
      const systemHealth = {
        database: await checkDatabaseHealth(),
        emailService: await checkEmailServiceHealth(),
        openaiService: await checkOpenAIServiceHealth(),
        priorityQueue: priorityQueue.getStats(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      };

      // Recent activity metrics
      const recentActivity = {
        newUsersLast24h: await databaseStorage.getUserCountSince(last24h),
        newUsersLast7d: await databaseStorage.getUserCountSince(last7d),
        activeSubscriptionsLast24h: await databaseStorage.getSubscriptionCountSince(last24h),
        documentsAnalyzedLast24h: await databaseStorage.getDocumentAnalysisCountSince(last24h),
        documentsAnalyzedLast7d: await databaseStorage.getDocumentAnalysisCountSince(last7d)
      };

      res.json({
        overview: {
          totalUsers,
          activeSubscriptions,
          pendingEmailRequests: pendingEmailRequests.length,
          securityEvents24h: securityStats.last24Hours.total,
          criticalAlerts: securityStats.recentCritical.length
        },
        systemHealth,
        recentActivity,
        securityStats
      });

    } catch (error) {
      console.error("Admin dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  });

  /**
   * User Management - Get users with search and filtering
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

      res.json(users);

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

      res.json({
        user: {
          ...user,
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
   * Update User - Admin can modify user details
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
          priorityQueue: priorityQueue.getStats()
        },
        system: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          loadAverage: process.loadavg ? process.loadavg() : null,
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
   * Security Events - Get recent security events with filtering
   */
  app.get("/api/admin/security-events", requireAdminAuth, async (req: Request, res: Response) => {
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
   * Analytics - Subscription and usage analytics
   */
  app.get("/api/admin/analytics", requireAdminAuth, async (req: Request, res: Response) => {
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

}

// Helper functions for system health checks
async function checkDatabaseHealth(): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    await databaseStorage.getTotalUserCount();
    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error' 
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

  return {
    userGrowth: await databaseStorage.getUserGrowthData(startDate),
    subscriptionAnalytics: await databaseStorage.getSubscriptionAnalytics(startDate),
    usageAnalytics: await databaseStorage.getUsageAnalytics(startDate),
    revenueAnalytics: await databaseStorage.getRevenueAnalytics(startDate)
  };
}