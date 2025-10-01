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
  // STARTER
  'price_1SDLWeQd9szft5zEfCK9YOvA': SubscriptionTier.STARTER,
  'price_1SDM4jQd9szft5zEMXyN0dSd': SubscriptionTier.STARTER,
  
  // PROFESSIONAL
  'price_1SDMCRQd9szft5zE1q5CpYg6': SubscriptionTier.PROFESSIONAL,
  'price_1SDMCSQd9szft5zEx3rozWrQ': SubscriptionTier.PROFESSIONAL,
  
  // BUSINESS
  'price_1SDMHHQd9szft5zEvUJDB10s': SubscriptionTier.BUSINESS,
  'price_1SDMHHQd9szft5zEU2K5N1fy': SubscriptionTier.BUSINESS,
  
  // ENTERPRISE
  'price_1SDMM1Qd9szft5zE53KobCmz': SubscriptionTier.ENTERPRISE,
  'price_1SDMM1Qd9szft5zEn3PQjFk3': SubscriptionTier.ENTERPRISE,
  
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

  async getUserSubscriptionWithUsage(userId: string): Promise<any> {
    // Stub: Return basic subscription data
    console.warn('getUserSubscriptionWithUsage called but not fully implemented');
    return {
      tier: 'free',
      status: 'active',
      usage: { requests: 0, limit: 1000 }
    };
  },

  async getUserSubscriptionDetails(userId: string): Promise<any> {
    console.warn('getUserSubscriptionDetails called but not fully implemented');
    return { tier: 'free', status: 'active' };
  },

  async trackUsage(userId: string, amount: number, model?: string, metadata?: any): Promise<void> {
    console.log(`Usage tracked: ${userId}, amount: ${amount}, model: ${model}`);
    // Stub: No-op for now
  },

  async cancelSubscription(userId: string, immediate?: boolean): Promise<any> {
    console.warn('cancelSubscription called but not fully implemented');
    return { success: true, message: 'Subscription cancelled' };
  },

  async reactivateSubscription(userId: string): Promise<any> {
    console.warn('reactivateSubscription called but not fully implemented');
    return { success: true, message: 'Subscription reactivated' };
  },

  async updateSubscriptionTier(userId: string, tier: string, reason?: string): Promise<any> {
    console.warn('updateSubscriptionTier called but not fully implemented');
    return { success: true, tier };
  },

  async extendSubscription(userId: string, days: number, reason?: string): Promise<any> {
    console.warn('extendSubscription called but not fully implemented');
    return { success: true, extendedBy: days };
  },

  async validateSubscriptionToken(token: string, fingerprint?: string, ip?: string): Promise<any> {
    console.warn('validateSubscriptionToken called but not fully implemented');
    return null;
  },

  async revokeSubscriptionToken(token: string, reason?: string): Promise<boolean> {
    console.warn('revokeSubscriptionToken called but not fully implemented');
    return true;
  },

  async revokeAllUserTokens(userId: string, reason?: string): Promise<number> {
    console.warn('revokeAllUserTokens called but not fully implemented');
    return 0;
  },

  async auditSubscriptionTiers(): Promise<any[]> {
    console.warn('auditSubscriptionTiers called but not fully implemented');
    return [];
  },

  async getTokenBySession(sessionId: string): Promise<string | null> {
    console.warn('getTokenBySession called but not fully implemented');
    return null;
  },

  async validateUserTier(userId: string): Promise<any> {
    console.warn('validateUserTier called but not fully implemented');
    return { valid: true, tier: 'free' };
  },

  async createSubscriptionUser(data: any): Promise<string> {
    console.warn('createSubscriptionUser called but not fully implemented');
    return 'user-' + Date.now();
  },

  async createStripeSubscription(data: any): Promise<any> {
    console.warn('createStripeSubscription called but not fully implemented');
    return { id: 'sub-' + Date.now(), status: 'active' };
  },

  async generateSubscriptionToken(userId: string, subscriptionId: string): Promise<string> {
    console.warn('generateSubscriptionToken called but not fully implemented');
    return 'token-' + Date.now();
  },

  async storeSessionToken(sessionId: string, token: string, userId: string): Promise<void> {
    console.log(`Session token stored: ${sessionId}`);
  },

  async syncStripeSubscription(data: any): Promise<void> {
    console.warn('syncStripeSubscription called but not fully implemented');
  },

  async ensureCollectiveFreeUserExists(): Promise<void> {
    console.log('ensureCollectiveFreeUserExists called');
  },

  async createAdminUltimateSubscription(userId: string): Promise<any> {
    console.warn('createAdminUltimateSubscription called but not fully implemented');
    return { id: 'ultimate-' + Date.now(), tier: 'ultimate' };
  },

  async isAdminByEmail(userId: string): Promise<boolean> {
    console.warn('isAdminByEmail called but not fully implemented');
    return false;
  },
  };
