import { db } from './db';
import { organizations } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Subscription tiers in order of capability
 */
export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
  ULTIMATE = 'ultimate', // Internal tier - not publicly available
}

/**
 * Plan configuration with default limits
 */
export interface PlanLimits {
  tier: SubscriptionTier;
  displayName: string;
  defaultSeats: number | null; // null = unlimited
  maxWorkspaces: number | null; // null = unlimited
  maxDocumentsPerWorkspace: number | null;
  hasOrganizations: boolean;
  hasWorkspaces: boolean;
  hasActivity: boolean;
  hasRealtime: boolean;
  hasApiKeys: boolean;
  hasPrioritySupport: boolean;
  rateLimit: number; // requests per minute
  isPublic: boolean; // Whether tier is publicly available for purchase
}

/**
 * Plan definitions with their limits
 */
export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    displayName: 'Free',
    defaultSeats: 1,
    maxWorkspaces: 0,
    maxDocumentsPerWorkspace: 10,
    hasOrganizations: false,
    hasWorkspaces: false,
    hasActivity: false,
    hasRealtime: false,
    hasApiKeys: false,
    hasPrioritySupport: false,
    rateLimit: 60, // 60 rpm
    isPublic: true,
  },
  [SubscriptionTier.STARTER]: {
    tier: SubscriptionTier.STARTER,
    displayName: 'Starter',
    defaultSeats: 3,
    maxWorkspaces: 3,
    maxDocumentsPerWorkspace: 50,
    hasOrganizations: false,
    hasWorkspaces: false,
    hasActivity: false,
    hasRealtime: false,
    hasApiKeys: false,
    hasPrioritySupport: false,
    rateLimit: 120, // 120 rpm
    isPublic: true,
  },
  [SubscriptionTier.PROFESSIONAL]: {
    tier: SubscriptionTier.PROFESSIONAL,
    displayName: 'Professional',
    defaultSeats: 5,
    maxWorkspaces: 10,
    maxDocumentsPerWorkspace: 200,
    hasOrganizations: true,
    hasWorkspaces: true,
    hasActivity: true,
    hasRealtime: false,
    hasApiKeys: true,
    hasPrioritySupport: false,
    rateLimit: 300, // 300 rpm
    isPublic: true,
  },
  [SubscriptionTier.BUSINESS]: {
    tier: SubscriptionTier.BUSINESS,
    displayName: 'Business',
    defaultSeats: 20,
    maxWorkspaces: 25,
    maxDocumentsPerWorkspace: 1000,
    hasOrganizations: true,
    hasWorkspaces: true,
    hasActivity: true,
    hasRealtime: true,
    hasApiKeys: true,
    hasPrioritySupport: false,
    rateLimit: 600, // 600 rpm
    isPublic: true,
  },
  [SubscriptionTier.ENTERPRISE]: {
    tier: SubscriptionTier.ENTERPRISE,
    displayName: 'Enterprise',
    defaultSeats: 100,
    maxWorkspaces: 100,
    maxDocumentsPerWorkspace: 5000,
    hasOrganizations: true,
    hasWorkspaces: true,
    hasActivity: true,
    hasRealtime: true,
    hasApiKeys: true,
    hasPrioritySupport: true,
    rateLimit: 1500, // 1500 rpm
    isPublic: true,
  },
  [SubscriptionTier.ULTIMATE]: {
    tier: SubscriptionTier.ULTIMATE,
    displayName: 'Ultimate',
    defaultSeats: null, // unlimited
    maxWorkspaces: null, // unlimited
    maxDocumentsPerWorkspace: null, // unlimited
    hasOrganizations: true,
    hasWorkspaces: true,
    hasActivity: true,
    hasRealtime: true,
    hasApiKeys: true,
    hasPrioritySupport: true,
    rateLimit: 3000, // 3000 rpm
    isPublic: false, // Internal tier only
  },
};

/**
 * Stripe Product/Price ID to Tier mapping
 * Update these with your actual Stripe product IDs
 */
const STRIPE_PRICE_TO_TIER: Record<string, SubscriptionTier> = {
  // Example mappings - replace with your actual Stripe price IDs
  'price_free': SubscriptionTier.FREE,
  'price_starter_monthly': SubscriptionTier.STARTER,
  'price_starter_yearly': SubscriptionTier.STARTER,
  'price_professional_monthly': SubscriptionTier.PROFESSIONAL,
  'price_professional_yearly': SubscriptionTier.PROFESSIONAL,
  'price_business_monthly': SubscriptionTier.BUSINESS,
  'price_business_yearly': SubscriptionTier.BUSINESS,
  'price_enterprise_monthly': SubscriptionTier.ENTERPRISE,
  'price_enterprise_yearly': SubscriptionTier.ENTERPRISE,
  // Note: ULTIMATE is not mapped - it's manually assigned only
};

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  limits: PlanLimits;
  seatLimit: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export const subscriptionService = {
  /**
   * Get plan limits for a specific tier
   */
  getPlanLimits(tier: SubscriptionTier): PlanLimits {
    return PLAN_LIMITS[tier] || PLAN_LIMITS[SubscriptionTier.FREE];
  },

  /**
   * Get all publicly available tiers (excludes ULTIMATE)
   */
  getPublicTiers(): PlanLimits[] {
    return Object.values(PLAN_LIMITS).filter(plan => plan.isPublic);
  },

  /**
   * Derive subscription tier from Stripe price ID
   */
  getTierFromStripePriceId(priceId: string | null): SubscriptionTier {
    if (!priceId) return SubscriptionTier.FREE;
    return STRIPE_PRICE_TO_TIER[priceId] || SubscriptionTier.FREE;
  },

  /**
   * Get organization's subscription information
   */
  async getOrganizationSubscription(orgId: string): Promise<SubscriptionInfo> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    // Derive tier from billing_tier column or Stripe subscription
    let tier: SubscriptionTier;
    if (org.billing_tier) {
      tier = org.billing_tier as SubscriptionTier;
    } else {
      // Fallback: could fetch from Stripe API if needed
      tier = SubscriptionTier.FREE;
    }

    const limits = this.getPlanLimits(tier);

    // Use org's custom seat_limit if set, otherwise use plan default
    const seatLimit = org.seat_limit !== null ? org.seat_limit : limits.defaultSeats;

    return {
      tier,
      limits,
      seatLimit,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscriptionId: org.stripe_subscription_id,
    };
  },

  /**
   * Check if organization has access to a specific feature
   */
  async hasFeatureAccess(orgId: string, feature: keyof PlanLimits): Promise<boolean> {
    const subscription = await this.getOrganizationSubscription(orgId);
    const featureValue = subscription.limits[feature];
    
    // Boolean features
    if (typeof featureValue === 'boolean') {
      return featureValue;
    }
    
    // Numeric features (null means unlimited)
    if (typeof featureValue === 'number' || featureValue === null) {
      return true;
    }
    
    return false;
  },

  /**
   * Check if tier supports organizations
   */
  tierSupportsOrganizations(tier: SubscriptionTier): boolean {
    const limits = this.getPlanLimits(tier);
    return limits.hasOrganizations;
  },

  /**
   * Check if tier supports workspaces
   */
  tierSupportsWorkspaces(tier: SubscriptionTier): boolean {
    const limits = this.getPlanLimits(tier);
    return limits.hasWorkspaces;
  },

  /**
   * Get upgrade URL for a given tier
   */
  getUpgradeUrl(currentTier: SubscriptionTier, targetTier?: SubscriptionTier): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    if (targetTier) {
      return `${baseUrl}/settings/billing/upgrade?to=${targetTier}`;
    }
    
    // Suggest next public tier up
    const publicTiers = [
      SubscriptionTier.FREE,
      SubscriptionTier.STARTER,
      SubscriptionTier.PROFESSIONAL,
      SubscriptionTier.BUSINESS,
      SubscriptionTier.ENTERPRISE,
      // ULTIMATE not included - not publicly available
    ];
    
    const currentIndex = publicTiers.indexOf(currentTier);
    const nextTier = publicTiers[currentIndex + 1] || SubscriptionTier.ENTERPRISE;
    
    return `${baseUrl}/settings/billing/upgrade?to=${nextTier}`;
  },

  /**
   * Format seat limit for display
   */
  formatSeatLimit(seatLimit: number | null): string {
    return seatLimit === null ? 'Unlimited' : seatLimit.toString();
  },

  /**
   * Check if organization can add more members
   */
  async canAddMembers(orgId: string, currentMemberCount: number, addCount: number = 1): Promise<{
    allowed: boolean;
    reason?: string;
    upgradeUrl?: string;
  }> {
    const subscription = await this.getOrganizationSubscription(orgId);
    
    if (subscription.seatLimit === null) {
      return { allowed: true };
    }
    
    if (currentMemberCount + addCount > subscription.seatLimit) {
      return {
        allowed: false,
        reason: `Seat limit reached (${subscription.seatLimit} seats). Upgrade your plan to add more members.`,
        upgradeUrl: this.getUpgradeUrl(subscription.tier),
      };
    }
    
    return { allowed: true };
  },

  /**
   * Update organization's billing tier (typically called by Stripe webhook)
   */
  async updateOrganizationTier(
    orgId: string,
    tier: SubscriptionTier,
    stripeSubscriptionId?: string
  ): Promise<void> {
    const limits = this.getPlanLimits(tier);
    
    await db
      .update(organizations)
      .set({
        billing_tier: tier,
        stripe_subscription_id: stripeSubscriptionId || null,
        // Reset to plan default if not explicitly set
        seat_limit: limits.defaultSeats,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, orgId));
  },

  /**
   * Manually assign ULTIMATE tier (owner only)
   * This should only be called by system admins/owner
   */
  async assignUltimateTier(orgId: string, assignedBy: string): Promise<void> {
    console.log(`ULTIMATE tier manually assigned to org ${orgId} by ${assignedBy}`);
    
    await db
      .update(organizations)
      .set({
        billing_tier: SubscriptionTier.ULTIMATE,
        stripe_subscription_id: null, // No Stripe subscription for internal tier
        seat_limit: null, // Unlimited
        updated_at: new Date(),
      })
      .where(eq(organizations.id, orgId));
  },

  /**
   * Get recommended tier for feature requirements
   * Only recommends public tiers
   */
  getRecommendedTier(requirements: {
    needsOrganizations?: boolean;
    needsWorkspaces?: boolean;
    needsRealtime?: boolean;
    needsApiKeys?: boolean;
    minSeats?: number;
  }): SubscriptionTier {
    const publicPlans = this.getPublicTiers();
    
    for (const plan of publicPlans) {
      const meetsRequirements =
        (!requirements.needsOrganizations || plan.hasOrganizations) &&
        (!requirements.needsWorkspaces || plan.hasWorkspaces) &&
        (!requirements.needsRealtime || plan.hasRealtime) &&
        (!requirements.needsApiKeys || plan.hasApiKeys) &&
        (!requirements.minSeats || 
          (plan.defaultSeats === null || plan.defaultSeats >= requirements.minSeats));
      
      if (meetsRequirements) {
        return plan.tier;
      }
    }
    
    return SubscriptionTier.ENTERPRISE;
  },
};
