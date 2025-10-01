import { db } from './db';
import crypto from 'crypto';
import { organizations, users, userSubscriptions, usageRecords, subscriptionTokens, sessionTokens } from '../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

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
    try {
      // For free/anonymous users, return free tier with basic limits
      if (!userId || userId === 'anonymous' || userId.startsWith('session_')) {
        return {
          tier: {
            id: 'free',
            displayName: 'Free',
            limits: {
              documentsPerMonth: 10,
              maxDocumentSize: 5 * 1024 * 1024, // 5MB
            },
            model: 'gpt-4o-mini'
          },
          usage: {
            documentsAnalyzed: 0,
            lastReset: new Date()
          },
          subscription: null
        };
      }

      // Check if user is admin
      const isAdmin = await this.isAdminByEmail(userId);
      if (isAdmin) {
        return {
          tier: {
            id: 'ultimate',
            displayName: 'Ultimate',
            limits: {
              documentsPerMonth: -1, // Unlimited
              maxDocumentSize: -1
            },
            model: 'gpt-4o'
          },
          usage: {
            documentsAnalyzed: 0,
            lastReset: new Date()
          },
          subscription: {
            status: 'active',
            tier: 'ultimate'
          }
        };
      }

      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        // User not found, return free tier
        return {
          tier: {
            id: 'free',
            displayName: 'Free',
            limits: {
              documentsPerMonth: 10,
              maxDocumentSize: 5 * 1024 * 1024
            },
            model: 'gpt-4o-mini'
          },
          usage: {
            documentsAnalyzed: 0,
            lastReset: new Date()
          },
          subscription: null
        };
      }

      // TODO: Implement actual usage tracking from database
      // For now, return free tier with default limits
      return {
        tier: {
          id: 'free',
          displayName: 'Free',
          limits: {
            documentsPerMonth: 10,
            maxDocumentSize: 5 * 1024 * 1024
          },
          model: 'gpt-4o-mini'
        },
        usage: {
          documentsAnalyzed: 0,
          lastReset: new Date()
        },
        subscription: user ? { status: 'active', tier: 'free' } : null
      };
    } catch (error) {
      console.error('Error getting user subscription:', error);
      // Return free tier on error to avoid blocking users
      return {
        tier: {
          id: 'free',
          displayName: 'Free',
          limits: {
            documentsPerMonth: 10,
            maxDocumentSize: 5 * 1024 * 1024
          },
          model: 'gpt-4o-mini'
        },
        usage: {
          documentsAnalyzed: 0,
          lastReset: new Date()
        },
        subscription: null
      };
    }
  },

  // ==================== FULL IMPLEMENTATIONS ====================
  
  async getUserSubscriptionDetails(userId: string): Promise<any> {
    return this.getUserSubscriptionWithUsage(userId);
  },

  async trackUsage(userId: string, amount: number, model?: string, metadata?: any): Promise<void> {
    try {
      const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM
      
      // Find or create usage record for current period
      const [existingRecord] = await db
        .select()
        .from(usageRecords)
        .where(and(
          eq(usageRecords.userId, userId),
          eq(usageRecords.period, currentPeriod)
        ))
        .limit(1);

      if (existingRecord) {
        // Update existing record
        await db
          .update(usageRecords)
          .set({
            tokensUsed: sql`${usageRecords.tokensUsed} + ${amount}`,
            updatedAt: new Date()
          })
          .where(eq(usageRecords.id, existingRecord.id));
      } else {
        // Create new record
        await db.insert(usageRecords).values({
          userId,
          period: currentPeriod,
          tokensUsed: amount,
          documentsAnalyzed: 0,
          cost: '0'
        });
      }
      
      console.log(`📊 Usage tracked: ${userId} - ${amount} tokens (${model || 'default'})`);
    } catch (error) {
      console.error('Error tracking usage:', error);
      // Don't throw - usage tracking shouldn't block operations
    }
  },

  async validateSubscriptionToken(token: string, fingerprint?: string, ip?: string): Promise<any> {
    try {
      const [tokenRecord] = await db
        .select()
        .from(subscriptionTokens)
        .where(eq(subscriptionTokens.token, token))
        .limit(1);

      if (!tokenRecord) {
        console.log(`ℹ️ Token not found: ${token.substring(0, 16)}...`);
        return null;
      }

      // Check if token is expired
      if (tokenRecord.expiresAt < new Date()) {
        console.log(`⚠️ Token expired: ${token.substring(0, 16)}...`);
        return null;
      }

      // Update usage count and last used
      await db
        .update(subscriptionTokens)
        .set({
          usageCount: sql`${subscriptionTokens.usageCount} + 1`,
          lastUsed: new Date(),
          updatedAt: new Date()
        })
        .where(eq(subscriptionTokens.id, tokenRecord.id));

      // Get full subscription data
      return this.getUserSubscriptionWithUsage(tokenRecord.userId);
    } catch (error) {
      console.error('Error validating token:', error);
      return null;
    }
  },

  async cancelSubscription(userId: string, immediate?: boolean): Promise<any> {
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active')
        ))
        .limit(1);

      if (!subscription) {
        return { success: false, message: 'No active subscription found' };
      }

      if (immediate) {
        // Cancel immediately
        await db
          .update(userSubscriptions)
          .set({
            status: 'canceled',
            updatedAt: new Date()
          })
          .where(eq(userSubscriptions.id, subscription.id));
      } else {
        // Cancel at period end
        await db
          .update(userSubscriptions)
          .set({
            cancelAtPeriodEnd: true,
            updatedAt: new Date()
          })
          .where(eq(userSubscriptions.id, subscription.id));
      }

      console.log(`✅ Subscription cancelled for user ${userId} (immediate: ${immediate})`);
      return { success: true, message: 'Subscription cancelled successfully' };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return { success: false, message: 'Failed to cancel subscription' };
    }
  },

  async reactivateSubscription(userId: string): Promise<any> {
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .orderBy(desc(userSubscriptions.createdAt))
        .limit(1);

      if (!subscription) {
        return { success: false, message: 'No subscription found' };
      }

      await db
        .update(userSubscriptions)
        .set({
          status: 'active',
          cancelAtPeriodEnd: false,
          updatedAt: new Date()
        })
        .where(eq(userSubscriptions.id, subscription.id));

      console.log(`✅ Subscription reactivated for user ${userId}`);
      return { success: true, message: 'Subscription reactivated successfully' };
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      return { success: false, message: 'Failed to reactivate subscription' };
    }
  },

  async updateSubscriptionTier(userId: string, tier: string, reason?: string): Promise<any> {
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .orderBy(desc(userSubscriptions.createdAt))
        .limit(1);

      if (!subscription) {
        return { success: false, message: 'No subscription found' };
      }

      await db
        .update(userSubscriptions)
        .set({
          tierId: tier,
          updatedAt: new Date()
        })
        .where(eq(userSubscriptions.id, subscription.id));

      console.log(`✅ Tier updated for user ${userId}: ${tier} (reason: ${reason || 'none'})`);
      return { success: true, tier, message: 'Tier updated successfully' };
    } catch (error) {
      console.error('Error updating tier:', error);
      return { success: false, message: 'Failed to update tier' };
    }
  },

  async extendSubscription(userId: string, days: number, reason?: string): Promise<any> {
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .orderBy(desc(userSubscriptions.createdAt))
        .limit(1);

      if (!subscription) {
        return { success: false, message: 'No subscription found' };
      }

      const newEndDate = new Date(subscription.currentPeriodEnd);
      newEndDate.setDate(newEndDate.getDate() + days);

      await db
        .update(userSubscriptions)
        .set({
          currentPeriodEnd: newEndDate,
          updatedAt: new Date()
        })
        .where(eq(userSubscriptions.id, subscription.id));

      console.log(`✅ Subscription extended for user ${userId}: +${days} days (reason: ${reason || 'none'})`);
      return { success: true, extendedBy: days, newEndDate };
    } catch (error) {
      console.error('Error extending subscription:', error);
      return { success: false, message: 'Failed to extend subscription' };
    }
  },

  async revokeSubscriptionToken(token: string, reason?: string): Promise<boolean> {
    try {
      const result = await db
        .delete(subscriptionTokens)
        .where(eq(subscriptionTokens.token, token));

      console.log(`✅ Token revoked: ${token.substring(0, 16)}... (reason: ${reason || 'none'})`);
      return true;
    } catch (error) {
      console.error('Error revoking token:', error);
      return false;
    }
  },

  async revokeAllUserTokens(userId: string, reason?: string): Promise<number> {
    try {
      const tokens = await db
        .select()
        .from(subscriptionTokens)
        .where(eq(subscriptionTokens.userId, userId));

      await db
        .delete(subscriptionTokens)
        .where(eq(subscriptionTokens.userId, userId));

      console.log(`✅ Revoked ${tokens.length} tokens for user ${userId} (reason: ${reason || 'none'})`);
      return tokens.length;
    } catch (error) {
      console.error('Error revoking user tokens:', error);
      return 0;
    }
  },

  async auditSubscriptionTiers(): Promise<any[]> {
    try {
      // Get all users with subscriptions
      const subscriptions = await db
        .select({
          userId: userSubscriptions.userId,
          tierId: userSubscriptions.tierId,
          status: userSubscriptions.status,
          email: users.email
        })
        .from(userSubscriptions)
        .innerJoin(users, eq(userSubscriptions.userId, users.id));

      const issues: any[] = [];
      
      for (const sub of subscriptions) {
        // Check if admin users have ultimate tier
        const isAdmin = await this.isAdminByEmail(sub.userId);
        if (isAdmin && sub.tierId !== 'ultimate') {
          issues.push({
            userId: sub.userId,
            email: sub.email,
            expectedTier: 'ultimate',
            actualTier: sub.tierId,
            issue: 'Admin user without ultimate tier'
          });
        }
      }

      console.log(`✅ Audit complete: found ${issues.length} tier assignment issues`);
      return issues;
    } catch (error) {
      console.error('Error auditing tiers:', error);
      return [];
    }
  },

  async getTokenBySession(sessionId: string): Promise<string | null> {
    try {
      const [sessionToken] = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.sessionId, sessionId))
        .limit(1);

      return sessionToken?.token || null;
    } catch (error) {
      console.error('Error getting token by session:', error);
      return null;
    }
  },

  async validateUserTier(userId: string): Promise<any> {
    const subscription = await this.getUserSubscriptionWithUsage(userId);
    return { 
      valid: true, 
      tier: subscription.tier.id,
      message: 'Tier validation passed'
    };
  },

  async createSubscriptionUser(data: any): Promise<string> {
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          email: data.email,
          hashedPassword: data.hashedPassword || null,
        })
        .returning({ id: users.id });

      console.log(`✅ Created subscription user: ${newUser.id}`);
      return newUser.id;
    } catch (error) {
      console.error('Error creating subscription user:', error);
      throw error;
    }
  },

  async createStripeSubscription(data: any): Promise<any> {
    try {
      const [subscription] = await db
        .insert(userSubscriptions)
        .values({
          userId: data.userId,
          tierId: data.tierId || 'free',
          status: data.status || 'active',
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          currentPeriodStart: data.currentPeriodStart || new Date(),
          currentPeriodEnd: data.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false
        })
        .returning();

      console.log(`✅ Created Stripe subscription: ${subscription.id}`);
      return subscription;
    } catch (error) {
      console.error('Error creating Stripe subscription:', error);
      throw error;
    }
  },

  async generateSubscriptionToken(userId: string, subscriptionId: string): Promise<string> {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

      await db.insert(subscriptionTokens).values({
        token,
        userId,
        subscriptionId,
        tierId: 'free', // Will be updated based on actual subscription
        expiresAt
      });

      console.log(`✅ Generated subscription token for user ${userId}`);
      return token;
    } catch (error) {
      console.error('Error generating token:', error);
      throw error;
    }
  },

  async storeSessionToken(sessionId: string, token: string, userId: string): Promise<void> {
    try {
      await db.insert(sessionTokens).values({
        sessionId,
        token,
        userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      console.log(`✅ Stored session token for session ${sessionId.substring(0, 16)}...`);
    } catch (error) {
      console.error('Error storing session token:', error);
      // Don't throw - session token storage is optional
    }
  },

  async syncStripeSubscription(data: any): Promise<void> {
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.stripeSubscriptionId, data.subscriptionId))
        .limit(1);

      if (subscription) {
        await db
          .update(userSubscriptions)
          .set({
            status: data.status,
            currentPeriodStart: data.currentPeriodStart,
            currentPeriodEnd: data.currentPeriodEnd,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
            updatedAt: new Date()
          })
          .where(eq(userSubscriptions.id, subscription.id));

        console.log(`✅ Synced Stripe subscription: ${data.subscriptionId}`);
      }
    } catch (error) {
      console.error('Error syncing Stripe subscription:', error);
      // Don't throw - sync failures shouldn't block operations
    }
  },

  async ensureCollectiveFreeUserExists(): Promise<void> {
    // This method is for legacy compatibility - free users don't need special setup
    console.log('✅ Free tier users handled automatically');
  },

  async createAdminUltimateSubscription(userId: string): Promise<any> {
    try {
      // Check if subscription already exists
      const [existing] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);

      if (existing) {
        // Update to ultimate tier
        await db
          .update(userSubscriptions)
          .set({
            tierId: 'ultimate',
            status: 'active',
            updatedAt: new Date()
          })
          .where(eq(userSubscriptions.id, existing.id));
        
        console.log(`✅ Updated admin ${userId} to ultimate tier`);
        return existing;
      }

      // Create new ultimate subscription
      const [subscription] = await db
        .insert(userSubscriptions)
        .values({
          userId,
          tierId: 'ultimate',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          cancelAtPeriodEnd: false
        })
        .returning();

      console.log(`✅ Created admin ultimate subscription for ${userId}`);
      return subscription;
    } catch (error) {
      console.error('Error creating admin subscription:', error);
      throw error;
    }
  },

  async isAdminByEmail(userId: string): Promise<boolean> {
    const adminEmails = [
      'admin@readmyfineprint.com',
      'prodbybuddha@icloud.com', 
      'beatsbybuddha@gmail.com'
    ];
    
    try {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user && adminEmails.includes(user.email.toLowerCase())) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  },

};