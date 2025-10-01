import { Router, Request, Response } from 'express';
import { subscriptionService, SubscriptionTier } from './subscription-service';
import { createCheckoutSession } from './stripe-webhook';

const router = Router();

/**
 * GET /api/subscriptions/plans
 * Get all publicly available subscription plans
 * Note: ULTIMATE tier is not included (internal/owner only)
 */
router.get('/subscriptions/plans', (req: Request, res: Response) => {
  const publicPlans = subscriptionService.getPublicTiers();
  
  const plans = publicPlans.map((plan) => ({
    tier: plan.tier,
    display_name: plan.displayName,
    seats: subscriptionService.formatSeatLimit(plan.defaultSeats),
    max_workspaces: plan.maxWorkspaces === null ? 'Unlimited' : plan.maxWorkspaces,
    features: {
      organizations: plan.hasOrganizations,
      workspaces: plan.hasWorkspaces,
      activity: plan.hasActivity,
      realtime: plan.hasRealtime,
      api_keys: plan.hasApiKeys,
      priority_support: plan.hasPrioritySupport,
    },
    rate_limit: plan.rateLimit,
  }));

  res.json({ plans });
});

/**
 * GET /api/orgs/:orgId/subscription
 * Get organization's current subscription details
 * Requires: org membership
 */
router.get('/orgs/:orgId/subscription', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // Auth check (assumes middleware sets req.user and req.orgContext)
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!req.orgContext || req.orgContext.orgId !== orgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    const subscription = await subscriptionService.getOrganizationSubscription(orgId);

    res.json({
      tier: subscription.tier,
      plan_name: subscription.limits.displayName,
      seat_limit: subscriptionService.formatSeatLimit(subscription.seatLimit),
      is_internal_tier: !subscription.limits.isPublic,
      limits: {
        seats: subscription.seatLimit,
        workspaces: subscription.limits.maxWorkspaces,
        documents_per_workspace: subscription.limits.maxDocumentsPerWorkspace,
        rate_limit: subscription.limits.rateLimit,
      },
      features: {
        organizations: subscription.limits.hasOrganizations,
        workspaces: subscription.limits.hasWorkspaces,
        activity: subscription.limits.hasActivity,
        realtime: subscription.limits.hasRealtime,
        api_keys: subscription.limits.hasApiKeys,
        priority_support: subscription.limits.hasPrioritySupport,
      },
      stripe: {
        customer_id: subscription.stripeCustomerId,
        subscription_id: subscription.stripeSubscriptionId,
      },
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    return res.status(500).json({
      error: 'Failed to get subscription',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/orgs/:orgId/subscription/upgrade-options
 * Get available upgrade options for organization
 * Only shows public tiers
 * Requires: org admin
 */
router.get('/orgs/:orgId/subscription/upgrade-options', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!req.orgContext || req.orgContext.orgId !== orgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    // Only admins can view upgrade options
    if (req.orgContext.role !== 'admin') {
      return res.status(403).json({
        error: 'Only organization admins can view upgrade options',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const subscription = await subscriptionService.getOrganizationSubscription(orgId);
    const currentTier = subscription.tier;

    // If on ULTIMATE tier, no upgrades available
    if (currentTier === SubscriptionTier.ULTIMATE) {
      return res.json({
        current_tier: currentTier,
        upgrade_options: [],
        message: 'You are on the highest available tier',
      });
    }

    // Get all public tiers higher than current
    const publicTiers = [
      SubscriptionTier.FREE,
      SubscriptionTier.STARTER,
      SubscriptionTier.PROFESSIONAL,
      SubscriptionTier.BUSINESS,
      SubscriptionTier.ENTERPRISE,
    ];

    const currentIndex = publicTiers.indexOf(currentTier);
    const availableTiers = currentIndex >= 0 ? publicTiers.slice(currentIndex + 1) : publicTiers;

    const upgradeOptions = availableTiers.map((tier) => {
      const plan = subscriptionService.getPlanLimits(tier);
      return {
        tier: plan.tier,
        display_name: plan.displayName,
        upgrade_url: subscriptionService.getUpgradeUrl(currentTier, tier),
        seats: subscriptionService.formatSeatLimit(plan.defaultSeats),
        max_workspaces: plan.maxWorkspaces === null ? 'Unlimited' : plan.maxWorkspaces,
        features: {
          organizations: plan.hasOrganizations,
          workspaces: plan.hasWorkspaces,
          activity: plan.hasActivity,
          realtime: plan.hasRealtime,
          api_keys: plan.hasApiKeys,
          priority_support: plan.hasPrioritySupport,
        },
        rate_limit: plan.rateLimit,
      };
    });

    res.json({
      current_tier: currentTier,
      upgrade_options: upgradeOptions,
    });
  } catch (error) {
    console.error('Error getting upgrade options:', error);
    return res.status(500).json({
      error: 'Failed to get upgrade options',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/orgs/:orgId/subscription/upgrade
 * Initiate upgrade process (creates Stripe checkout session)
 * Only allows upgrades to public tiers
 * Requires: org admin
 */
router.post('/orgs/:orgId/subscription/upgrade', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { target_tier, price_id } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!req.orgContext || req.orgContext.orgId !== orgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    if (req.orgContext.role !== 'admin') {
      return res.status(403).json({
        error: 'Only organization admins can upgrade subscription',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    if (!target_tier || !price_id) {
      return res.status(400).json({
        error: 'target_tier and price_id are required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate target tier is public and valid
    const targetPlan = subscriptionService.getPlanLimits(target_tier);
    if (!targetPlan.isPublic) {
      return res.status(400).json({
        error: 'Cannot upgrade to internal tier',
        code: 'INVALID_TIER',
      });
    }

    const subscription = await subscriptionService.getOrganizationSubscription(orgId);

    // Check if target tier is actually an upgrade
    const publicTiers = [
      SubscriptionTier.FREE,
      SubscriptionTier.STARTER,
      SubscriptionTier.PROFESSIONAL,
      SubscriptionTier.BUSINESS,
      SubscriptionTier.ENTERPRISE,
    ];

    const currentIndex = publicTiers.indexOf(subscription.tier);
    const targetIndex = publicTiers.indexOf(target_tier);

    if (targetIndex <= currentIndex && subscription.tier !== SubscriptionTier.ULTIMATE) {
      return res.status(400).json({
        error: 'Target tier must be higher than current tier',
        code: 'INVALID_UPGRADE',
      });
    }

    // Create Stripe checkout session
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const checkoutUrl = await createCheckoutSession(
      orgId,
      price_id,
      `${appUrl}/orgs/${orgId}/settings/billing/success`,
      `${appUrl}/orgs/${orgId}/settings/billing/cancel`
    );

    res.json({
      checkout_url: checkoutUrl,
      target_tier,
    });
  } catch (error) {
    console.error('Error initiating upgrade:', error);
    return res.status(500).json({
      error: 'Failed to initiate upgrade',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/subscriptions/recommend
 * Get recommended tier based on requirements
 * Only recommends public tiers
 */
router.post('/subscriptions/recommend', (req: Request, res: Response) => {
  const {
    needs_organizations,
    needs_workspaces,
    needs_realtime,
    needs_api_keys,
    min_seats,
  } = req.body;

  const recommendedTier = subscriptionService.getRecommendedTier({
    needsOrganizations: needs_organizations,
    needsWorkspaces: needs_workspaces,
    needsRealtime: needs_realtime,
    needsApiKeys: needs_api_keys,
    minSeats: min_seats,
  });

  const plan = subscriptionService.getPlanLimits(recommendedTier);

  res.json({
    recommended_tier: recommendedTier,
    plan_name: plan.displayName,
    seats: subscriptionService.formatSeatLimit(plan.defaultSeats),
    features: {
      organizations: plan.hasOrganizations,
      workspaces: plan.hasWorkspaces,
      activity: plan.hasActivity,
      realtime: plan.hasRealtime,
      api_keys: plan.hasApiKeys,
      priority_support: plan.hasPrioritySupport,
    },
  });
});

/**
 * POST /api/admin/orgs/:orgId/assign-ultimate
 * Manually assign ULTIMATE tier to organization
 * Requires: system admin/owner authentication
 * This is an internal endpoint, not publicly documented
 */
router.post('/admin/orgs/:orgId/assign-ultimate', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // TODO: Add proper admin/owner authentication check
    // For now, just check if user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // TODO: Verify user is system owner
    // This should check against a list of authorized admin user IDs
    // or a specific admin role in the database

    await subscriptionService.assignUltimateTier(orgId, req.user.id);

    res.json({
      message: 'ULTIMATE tier assigned successfully',
      org_id: orgId,
      tier: SubscriptionTier.ULTIMATE,
    });
  } catch (error) {
    console.error('Error assigning ULTIMATE tier:', error);
    return res.status(500).json({
      error: 'Failed to assign ULTIMATE tier',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;

/**
 * POST /api/orgs/:orgId/subscription/portal
 * Get Stripe customer portal URL for managing subscription
 * Requires: org admin
 */
router.post('/orgs/:orgId/subscription/portal', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!req.orgContext || req.orgContext.orgId !== orgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    if (req.orgContext.role !== 'admin') {
      return res.status(403).json({
        error: 'Only organization admins can access billing portal',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const returnUrl = `${appUrl}/orgs/${orgId}/settings/billing`;

    const { createPortalSession } = await import('./stripe-webhook');
    const portalUrl = await createPortalSession(orgId, returnUrl);

    res.json({
      portal_url: portalUrl,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create portal session',
      code: 'INTERNAL_ERROR',
    });
  }
});
