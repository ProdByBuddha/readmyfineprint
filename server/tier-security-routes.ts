/**
 * Tier Security Routes
 * API endpoints for tier-based security management
 */

import { Express, Request, Response } from "express";
import { requireUserAuth, optionalUserAuth } from "./auth";
import { 
  getUserSecurityStatus, 
  getTierSecurityRequirements, 
  getAllTierSecurityRequirements,
  getSecurityRecommendations,
  validateSecurityAction,
  getTierFeatureAvailability
} from "./tier-security-service";
import { securityLogger } from "./security-logger";
import { z } from "zod";

// Validation schemas
const validateActionSchema = z.object({
  action: z.enum(['account_recovery', 'email_change'])
});

/**
 * Register tier security routes
 */
export function registerTierSecurityRoutes(app: Express) {

  /**
   * Get current user's security status and compliance
   * GET /api/security/status
   */
  app.get("/api/security/status", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const status = await getUserSecurityStatus(userId);

      // Log security status check
      securityLogger.logSecurityEvent({
        eventType: 'SECURITY_STATUS_CHECK' as any,
        severity: 'LOW' as any,
        message: `User checked security status: ${status.compliance.isCompliant ? 'compliant' : 'non-compliant'}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: '/api/security/status',
        details: {
          userId,
          tier: status.tier,
          isCompliant: status.compliance.isCompliant,
          missingRequirements: status.compliance.missingRequirements
        }
      });

      res.json(status);
    } catch (error) {
      console.error("Error getting security status:", error);
      res.status(500).json({ error: "Failed to get security status" });
    }
  });

  /**
   * Get security recommendations for current user
   * GET /api/security/recommendations
   */
  app.get("/api/security/recommendations", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const recommendations = await getSecurityRecommendations(userId);

      res.json(recommendations);
    } catch (error) {
      console.error("Error getting security recommendations:", error);
      res.status(500).json({ error: "Failed to get security recommendations" });
    }
  });

  /**
   * Validate if user can perform a security action
   * POST /api/security/validate-action
   */
  app.post("/api/security/validate-action", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { action } = validateActionSchema.parse(req.body);

      const validation = await validateSecurityAction(userId, action);

      // Log security action validation
      securityLogger.logSecurityEvent({
        eventType: 'SECURITY_ACTION_VALIDATION' as any,
        severity: validation.allowed ? 'LOW' : 'MEDIUM' as any,
        message: `Security action validation: ${action} - ${validation.allowed ? 'allowed' : 'denied'}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: '/api/security/validate-action',
        details: {
          userId,
          action,
          allowed: validation.allowed,
          method: validation.method,
          requiresCompliance: validation.requiresCompliance
        }
      });

      res.json(validation);
    } catch (error) {
      console.error("Error validating security action:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to validate security action" });
    }
  });

  /**
   * Get tier security requirements (public endpoint)
   * GET /api/security/tier-requirements
   */
  app.get("/api/security/tier-requirements", optionalUserAuth, async (req: Request, res: Response) => {
    try {
      const tier = req.query.tier as string;
      
      if (tier) {
        // Get requirements for specific tier
        const requirements = getTierSecurityRequirements(tier);
        res.json(requirements);
      } else {
        // Get all tier requirements
        const allRequirements = getAllTierSecurityRequirements();
        res.json(allRequirements);
      }
    } catch (error) {
      console.error("Error getting tier requirements:", error);
      res.status(500).json({ error: "Failed to get tier requirements" });
    }
  });

  /**
   * Get tier feature availability
   * GET /api/security/tier-features/:tier
   */
  app.get("/api/security/tier-features/:tier", optionalUserAuth, async (req: Request, res: Response) => {
    try {
      const { tier } = req.params;
      const features = getTierFeatureAvailability(tier);
      
      res.json({
        tier,
        features
      });
    } catch (error) {
      console.error("Error getting tier features:", error);
      res.status(500).json({ error: "Failed to get tier features" });
    }
  });

  /**
   * Get security dashboard data (for user settings page)
   * GET /api/security/dashboard
   */
  app.get("/api/security/dashboard", requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      // Get comprehensive security information
      const [status, recommendations] = await Promise.all([
        getUserSecurityStatus(userId),
        getSecurityRecommendations(userId)
      ]);

      const dashboard = {
        securityStatus: status,
        recommendations: recommendations.recommendations,
        tierFeatures: getTierFeatureAvailability(status.tier),
        securityScore: calculateSecurityScore(status),
        nextSteps: getNextSecuritySteps(status, recommendations.recommendations)
      };

      res.json(dashboard);
    } catch (error) {
      console.error("Error getting security dashboard:", error);
      res.status(500).json({ error: "Failed to get security dashboard" });
    }
  });
}

/**
 * Calculate a security score based on user's security setup
 */
function calculateSecurityScore(status: any): {
  score: number;
  maxScore: number;
  percentage: number;
  level: 'weak' | 'moderate' | 'strong' | 'excellent';
} {
  let score = 0;
  let maxScore = 0;

  // Security questions
  maxScore += 30;
  if (status.compliance.hasMinSecurityQuestions) {
    score += 20;
    // Bonus for additional questions
    const extraQuestions = Math.max(0, status.securityQuestionCount - status.requirements.minSecurityQuestions);
    score += Math.min(10, extraQuestions * 2);
  }

  // Two-factor authentication
  maxScore += 40;
  if (status.twoFactorEnabled) {
    score += 40;
  }

  // Backup email
  maxScore += 20;
  if (status.backupEmailSet) {
    score += 20;
  }

  // Compliance bonus
  maxScore += 10;
  if (status.compliance.isCompliant) {
    score += 10;
  }

  const percentage = Math.round((score / maxScore) * 100);
  
  let level: 'weak' | 'moderate' | 'strong' | 'excellent';
  if (percentage < 40) level = 'weak';
  else if (percentage < 70) level = 'moderate';
  else if (percentage < 90) level = 'strong';
  else level = 'excellent';

  return {
    score,
    maxScore,
    percentage,
    level
  };
}

/**
 * Get next security steps for user
 */
function getNextSecuritySteps(status: any, recommendations: any[]): string[] {
  const requiredSteps = recommendations
    .filter(r => r.priority === 'required' && !r.completed)
    .map(r => r.description);

  const recommendedSteps = recommendations
    .filter(r => r.priority === 'recommended' && !r.completed)
    .slice(0, 2) // Limit to 2 recommendations
    .map(r => r.description);

  return [...requiredSteps, ...recommendedSteps];
}