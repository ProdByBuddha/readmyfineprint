import { Request, Response, NextFunction } from 'express';
import { subscriptionService, SubscriptionTier, PlanLimits } from './subscription-service';

/**
 * Extended Express Request with subscription context
 */
export interface RequestWithSubscription extends Request {
  subscription?: {
    tier: SubscriptionTier;
    limits: PlanLimits;
    seatLimit: number | null;
  };
}

/**
 * Middleware to load and attach subscription information to request
 * Requires req.orgContext to be set by organization middleware
 */
export function loadSubscriptionContext() {
  return async (req: RequestWithSubscription, res: Response, next: NextFunction) => {
    try {
      // Requires organization context to be loaded first
      if (!req.orgContext?.orgId) {
        return next();
      }

      const subscription = await subscriptionService.getOrganizationSubscription(
        req.orgContext.orgId
      );

      req.subscription = {
        tier: subscription.tier,
        limits: subscription.limits,
        seatLimit: subscription.seatLimit,
      };

      next();
    } catch (error) {
      console.error('Error loading subscription context:', error);
      // Don't fail the request, just log the error
      next();
    }
  };
}

/**
 * Middleware to require a minimum subscription tier
 * Returns 402 Payment Required if tier is insufficient
 */
export function requireSubscriptionTier(minTier: SubscriptionTier) {
  const tierOrder = [
    SubscriptionTier.FREE,
    SubscriptionTier.STARTER,
    SubscriptionTier.PROFESSIONAL,
    SubscriptionTier.BUSINESS,
    SubscriptionTier.ENTERPRISE,
    
  ];

  return (req: RequestWithSubscription, res: Response, next: NextFunction) => {
    if (!req.subscription) {
      return res.status(500).json({
        error: 'Subscription context not loaded',
        code: 'INTERNAL_ERROR',
      });
    }

    const currentTierIndex = tierOrder.indexOf(req.subscription.tier);
    const requiredTierIndex = tierOrder.indexOf(minTier);

    if (currentTierIndex < requiredTierIndex) {
      const upgradeUrl = subscriptionService.getUpgradeUrl(req.subscription.tier, minTier);
      const requiredPlan = subscriptionService.getPlanLimits(minTier);

      return res.status(402).json({
        error: `This feature requires ${requiredPlan.displayName} plan or higher`,
        code: 'UPGRADE_REQUIRED',
        current_tier: req.subscription.tier,
        required_tier: minTier,
        upgrade_url: upgradeUrl,
      });
    }

    next();
  };
}

/**
 * Middleware to require a specific feature to be enabled in the subscription
 */
export function requireFeature(feature: keyof PlanLimits) {
  return (req: RequestWithSubscription, res: Response, next: NextFunction) => {
    if (!req.subscription) {
      return res.status(500).json({
        error: 'Subscription context not loaded',
        code: 'INTERNAL_ERROR',
      });
    }

    const featureValue = req.subscription.limits[feature];
    let hasAccess = false;

    // Boolean features
    if (typeof featureValue === 'boolean') {
      hasAccess = featureValue;
    }
    // Numeric features (null = unlimited, 0 = disabled, >0 = enabled)
    else if (typeof featureValue === 'number') {
      hasAccess = featureValue > 0;
    }
    // null means unlimited
    else if (featureValue === null) {
      hasAccess = true;
    }

    if (!hasAccess) {
      const upgradeUrl = subscriptionService.getUpgradeUrl(req.subscription.tier);

      return res.status(402).json({
        error: `This feature is not available in your current plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature,
        current_tier: req.subscription.tier,
        upgrade_url: upgradeUrl,
      });
    }

    next();
  };
}

/**
 * Helper to check seat limit and return appropriate error response
 */
export async function checkSeatLimit(
  req: RequestWithSubscription,
  res: Response,
  orgId: string,
  currentMemberCount: number,
  addCount: number = 1
): Promise<boolean> {
  const result = await subscriptionService.canAddMembers(orgId, currentMemberCount, addCount);

  if (!result.allowed) {
    res.status(402).json({
      error: result.reason,
      code: 'SEAT_LIMIT_REACHED',
      current_members: currentMemberCount,
      seat_limit: req.subscription?.seatLimit,
      upgrade_url: result.upgradeUrl,
    });
    return false;
  }

  return true;
}

/**
 * Helper to create upsell response
 */
export function createUpsellResponse(
  currentTier: SubscriptionTier,
  feature: string,
  targetTier?: SubscriptionTier
) {
  const upgradeUrl = subscriptionService.getUpgradeUrl(currentTier, targetTier);
  const currentPlan = subscriptionService.getPlanLimits(currentTier);
  const targetPlan = targetTier 
    ? subscriptionService.getPlanLimits(targetTier)
    : subscriptionService.getPlanLimits(SubscriptionTier.BUSINESS);

  return {
    error: `${feature} requires ${targetPlan.displayName} plan or higher`,
    code: 'UPGRADE_REQUIRED',
    current_plan: {
      tier: currentTier,
      display_name: currentPlan.displayName,
    },
    required_plan: {
      tier: targetPlan.tier,
      display_name: targetPlan.displayName,
    },
    upgrade_url: upgradeUrl,
    features: {
      organizations: targetPlan.hasOrganizations,
      workspaces: targetPlan.hasWorkspaces,
      activity: targetPlan.hasActivity,
      realtime: targetPlan.hasRealtime,
      api_keys: targetPlan.hasApiKeys,
      seats: subscriptionService.formatSeatLimit(targetPlan.defaultSeats),
      max_workspaces: targetPlan.maxWorkspaces === null ? 'Unlimited' : targetPlan.maxWorkspaces,
    },
  };
}

/**
 * Middleware to enforce workspace limits
 */
export function checkWorkspaceLimit() {
  return async (req: RequestWithSubscription, res: Response, next: NextFunction) => {
    if (!req.subscription || !req.orgContext?.orgId) {
      return res.status(500).json({
        error: 'Context not loaded',
        code: 'INTERNAL_ERROR',
      });
    }

    const maxWorkspaces = req.subscription.limits.maxWorkspaces;

    // null means unlimited
    if (maxWorkspaces === null) {
      return next();
    }

    // TODO: Query actual workspace count for org
    // For now, just check if feature is enabled (maxWorkspaces > 0)
    if (maxWorkspaces === 0) {
      return res.status(402).json(
        createUpsellResponse(req.subscription.tier, 'Workspaces', SubscriptionTier.BUSINESS)
      );
    }

    next();
  };
}

/**
 * Express error handler for subscription-related errors
 */
export function subscriptionErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (error.message.includes('Seat limit') || error.message.includes('seat limit')) {
    return res.status(402).json({
      error: error.message,
      code: 'SEAT_LIMIT_REACHED',
      upgrade_url: subscriptionService.getUpgradeUrl(
        (req as RequestWithSubscription).subscription?.tier || SubscriptionTier.FREE
      ),
    });
  }

  if (error.message.includes('Workspace limit') || error.message.includes('workspace limit')) {
    return res.status(402).json({
      error: error.message,
      code: 'WORKSPACE_LIMIT_REACHED',
      upgrade_url: subscriptionService.getUpgradeUrl(
        (req as RequestWithSubscription).subscription?.tier || SubscriptionTier.FREE
      ),
    });
  }

  // Pass to next error handler
  next(error);
}
