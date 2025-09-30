import { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAdminAuth, requireUserAuth, optionalUserAuth, requireAdminViaSubscription } from "./auth";
import { emailRecoveryService } from "./email-recovery-service";
import { securityLogger, getClientInfo } from "./security-logger";
import { databaseStorage } from "./storage";
import { emailChangeRequestSchema, adminEmailChangeReviewSchema } from "@shared/schema";
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

/**
 * Translate email change request emails for admin view
 */
async function translateEmailChangeRequestsForAdmin(requests: any[]): Promise<any[]> {
  const translatedRequests = await Promise.all(requests.map(async (request) => {
    const translatedRequest = { ...request };
    
    // Translate current email
    if (request.currentEmail && request.currentEmail.includes('@subscription.internalusers.email')) {
      try {
        // Get user by pseudonymized email to find Stripe customer ID
        const user = await databaseStorage.getUserByEmail(request.currentEmail);
        if (user?.stripeCustomerId) {
          const customer = await stripe.customers.retrieve(user.stripeCustomerId);
          if (!('deleted' in customer) && typeof customer.email === 'string') {
            translatedRequest.currentEmail = customer.email;
            translatedRequest.pseudonymizedCurrentEmail = request.currentEmail;
          }
        }
      } catch (error) {
        console.error(`Failed to translate current email for request ${request.id}:`, error);
        translatedRequest.currentEmail = `[LOOKUP_FAILED] ${request.currentEmail}`;
      }
    }
    
    // Note: newEmail should already be real since it's user-provided
    return translatedRequest;
  }));
  
  return translatedRequests;
}

// Rate limiting for email recovery requests
const requestLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REQUESTS_PER_DAY = 3;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const limit = requestLimits.get(identifier);
  
  if (!limit || now > limit.resetTime) {
    requestLimits.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= MAX_REQUESTS_PER_DAY) {
    return false;
  }
  
  limit.count++;
  return true;
}

export function registerEmailRecoveryRoutes(app: Express) {

  /**
   * Get security questions for email recovery
   * Public endpoint for locked-out users
   */
  app.get("/api/auth/security-questions", async (req: Request, res: Response) => {
    try {
      const questions = emailRecoveryService.getSecurityQuestions();
      res.json({ questions });
    } catch (error) {
      console.error("Get security questions error:", error);
      res.status(500).json({ error: "Failed to get security questions" });
    }
  });

  /**
   * Submit email change request 
   * Public endpoint for locked-out users who can't access their current email
   */
  app.post("/api/auth/request-email-change", async (req: Request, res: Response) => {
    try {
      const { ip, userAgent } = getClientInfo(req);
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string || 'unknown';
      
      // Parse and validate request
      const requestData = emailChangeRequestSchema.parse(req.body);
      
      // Rate limiting by IP and current email
      const rateLimitKey = `${ip}:${requestData.currentEmail}`;
      if (!checkRateLimit(rateLimitKey)) {
        securityLogger.logRateLimit(ip, userAgent, '/api/auth/request-email-change', MAX_REQUESTS_PER_DAY);
        return res.status(429).json({ 
          error: `Too many email change requests. Maximum ${MAX_REQUESTS_PER_DAY} requests per 24 hours.`
        });
      }

      // Find user by current email
      const user = await databaseStorage.getUserByEmail(requestData.currentEmail);
      if (!user) {
        // Don't reveal whether email exists - same response as success
        return res.json({ 
          success: true, 
          message: "Email change request submitted. If the email address is valid, you will receive further instructions."
        });
      }

      // Create the email change request
      const result = await emailRecoveryService.createEmailChangeRequest(
        user.id, 
        requestData, 
        { ip, userAgent, deviceFingerprint }
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        success: true, 
        requestId: result.requestId,
        message: "Email change request submitted successfully. Our security team will review your request within 72 hours."
      });

    } catch (error) {
      console.error("Email change request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to submit email change request" });
    }
  });

  /**
   * Verify security answers for email change request
   * Public endpoint
   */
  app.post("/api/auth/verify-email-change/:requestId", async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const { ip, userAgent } = getClientInfo(req);
      
      const schema = z.object({
        securityAnswers: z.record(z.string())
      });
      
      const { securityAnswers } = schema.parse(req.body);

      // Get the request to find the user ID for logging
      const request = await databaseStorage.getEmailChangeRequest(requestId);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      const result = await emailRecoveryService.verifySecurityAnswers(requestId, securityAnswers);

      if (!result.success) {
        securityLogger.logEmailChangeVerificationFailed(
          ip, 
          userAgent, 
          requestId, 
          request.userId,
          request.attempts + 1
        );
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        success: true,
        message: "Security answers verified successfully. Your request will be prioritized for admin review."
      });

    } catch (error) {
      console.error("Email change verification error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to verify email change request" });
    }
  });

  /**
   * Get status of email change request
   * Public endpoint with request ID
   */
  app.get("/api/auth/email-change-status/:requestId", async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      
      const request = await databaseStorage.getEmailChangeRequest(requestId);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Return limited public information
      res.json({
        requestId: request.id,
        status: request.status,
        currentEmail: request.currentEmail,
        newEmail: request.newEmail,
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
        attempts: request.attempts,
        maxAttempts: request.maxAttempts
      });

    } catch (error) {
      console.error("Get email change status error:", error);
      res.status(500).json({ error: "Failed to get request status" });
    }
  });

  /**
   * Admin: Get pending email change requests (subscription-based auth)
   */
  app.get("/api/admin/email-change-requests-subscription", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      const requests = await emailRecoveryService.getPendingEmailChangeRequests(limit);
      
      // Translate pseudonymized emails to real emails for admin access
      const translatedRequests = await translateEmailChangeRequestsForAdmin(requests);
      
      res.json({ requests: translatedRequests });

    } catch (error) {
      console.error("Get pending email change requests error:", error);
      res.status(500).json({ error: "Failed to get pending requests" });
    }
  });

  /**
   * Admin: Get pending email change requests (original admin auth)
   * Requires admin authentication
   */
  app.get("/api/admin/email-change-requests", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      const requests = await emailRecoveryService.getPendingEmailChangeRequests(limit);
      
      // Translate pseudonymized emails to real emails for admin access
      const translatedRequests = await translateEmailChangeRequestsForAdmin(requests);
      
      res.json({ requests: translatedRequests });

    } catch (error) {
      console.error("Get pending email change requests error:", error);
      res.status(500).json({ error: "Failed to get pending requests" });
    }
  });

  /**
   * Admin: Review email change request (approve/reject) (subscription-based auth)
   */
  app.post("/api/admin/email-change-requests-subscription/:requestId/review", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const adminUserId = (req as any).user?.id;
      
      if (!adminUserId) {
        return res.status(401).json({ error: "Admin user ID not found" });
      }

      const reviewData = adminEmailChangeReviewSchema.parse(req.body);
      
      const result = await emailRecoveryService.reviewEmailChangeRequest(
        requestId,
        adminUserId,
        reviewData.action,
        reviewData.adminNotes
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        success: true,
        message: `Email change request ${reviewData.action}ed successfully`
      });

    } catch (error) {
      console.error("Review email change request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to review email change request" });
    }
  });

  /**
   * Admin: Review email change request (approve/reject) (original admin auth)
   * Requires admin authentication
   */
  app.post("/api/admin/email-change-requests/:requestId/review", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const adminUserId = (req as any).user?.id;
      
      if (!adminUserId) {
        return res.status(401).json({ error: "Admin user ID not found" });
      }

      const reviewData = adminEmailChangeReviewSchema.parse(req.body);
      
      const result = await emailRecoveryService.reviewEmailChangeRequest(
        requestId,
        adminUserId,
        reviewData.action,
        reviewData.adminNotes
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        success: true,
        message: `Email change request ${reviewData.action}ed successfully`
      });

    } catch (error) {
      console.error("Review email change request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to review email change request" });
    }
  });

  /**
   * Admin: Get detailed email change request (subscription-based auth)
   */
  app.get("/api/admin/email-change-requests-subscription/:requestId", requireAdminViaSubscription, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      
      const request = await databaseStorage.getEmailChangeRequest(requestId);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Get user details
      const user = await databaseStorage.getUser(request.userId);
      
      // Translate request emails for admin view
      const translatedRequests = await translateEmailChangeRequestsForAdmin([request]);
      const translatedRequest = translatedRequests[0];
      
      // Translate user email if needed
      let translatedUser = user;
      if (user && user.email?.includes('@subscription.internalusers.email') && user.stripeCustomerId) {
        try {
          const customer = await stripe.customers.retrieve(user.stripeCustomerId);
          if (!('deleted' in customer) && typeof customer.email === 'string') {
            translatedUser = {
              ...user,
              email: customer.email
            };
          }
        } catch (error) {
          console.error(`Failed to translate user email:`, error);
        }
      }
      
      res.json({ 
        request: translatedRequest,
        user: translatedUser ? {
          id: translatedUser.id,
          email: translatedUser.email,
          username: undefined, // Username property not available in User type
          createdAt: translatedUser.createdAt,
          pseudonymizedEmail: (translatedUser as any).pseudonymizedEmail
        } : null
      });

    } catch (error) {
      console.error("Get email change request details error:", error);
      res.status(500).json({ error: "Failed to get request details" });
    }
  });

  /**
   * Admin: Get detailed email change request (original admin auth)
   * Requires admin authentication
   */
  app.get("/api/admin/email-change-requests/:requestId", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      
      const request = await databaseStorage.getEmailChangeRequest(requestId);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Get user details
      const user = await databaseStorage.getUser(request.userId);
      
      // Translate request emails for admin view
      const translatedRequests = await translateEmailChangeRequestsForAdmin([request]);
      const translatedRequest = translatedRequests[0];
      
      // Translate user email if needed
      let translatedUser = user;
      if (user && user.email?.includes('@subscription.internalusers.email') && user.stripeCustomerId) {
        try {
          const customer = await stripe.customers.retrieve(user.stripeCustomerId);
          if (!('deleted' in customer) && typeof customer.email === 'string') {
            translatedUser = {
              ...user,
              email: customer.email
            };
          }
        } catch (error) {
          console.error(`Failed to translate user email:`, error);
        }
      }
      
      res.json({ 
        request: translatedRequest,
        user: translatedUser ? {
          id: translatedUser.id,
          email: translatedUser.email,
          username: undefined, // Username property not available in User type
          createdAt: translatedUser.createdAt,
          pseudonymizedEmail: (translatedUser as any).pseudonymizedEmail
        } : null
      });

    } catch (error) {
      console.error("Get email change request details error:", error);
      res.status(500).json({ error: "Failed to get request details" });
    }
  });

  /**
   * User: Get own email change requests (if logged in)
   * Requires user authentication
   */
  app.get("/api/users/me/email-change-requests", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const requests = await databaseStorage.getUserPendingEmailChangeRequests(userId);
      
      res.json({ requests });

    } catch (error) {
      console.error("Get user email change requests error:", error);
      res.status(500).json({ error: "Failed to get email change requests" });
    }
  });

  /**
   * Cleanup expired requests (internal cron job endpoint)
   */
  app.post("/api/internal/cleanup-expired-email-requests", async (req: Request, res: Response) => {
    try {
      // Simple API key check for internal endpoints
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const expiredCount = await emailRecoveryService.cleanupExpiredRequests();
      
      res.json({ 
        success: true, 
        expiredCount,
        message: `Cleaned up ${expiredCount} expired email change requests`
      });

    } catch (error) {
      console.error("Cleanup expired email requests error:", error);
      res.status(500).json({ error: "Failed to cleanup expired requests" });
    }
  });
}