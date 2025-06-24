import Stripe from 'stripe';
import crypto from 'crypto';
import type { UserSubscription, SubscriptionTier, User, InsertUserSubscription, UsageRecord, InsertUsageRecord } from '@shared/schema';
import { SUBSCRIPTION_TIERS, getTierById } from './subscription-tiers';
import { securityLogger } from './security-logger';
import { databaseStorage } from './storage';
import { hybridTokenService } from './hybrid-token-service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

interface CreateSubscriptionParams {
  userId: string;
  tierId: string;
  email: string;
  paymentMethodId: string;
  billingCycle: 'monthly' | 'yearly';
}

interface SubscriptionUsage {
  documentsAnalyzed: number;
  tokensUsed: number;
  cost: number;
  resetDate: Date;
}

export class SubscriptionService {
  
  constructor() {
    // Start periodic token cleanup (every 6 hours)
    this.startTokenCleanup();
  }

  /**
   * Start periodic cleanup of expired tokens
   */
  private startTokenCleanup(): void {
    const cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
    
    setInterval(async () => {
      try {
        console.log('🧹 Starting periodic token cleanup...');
        const results = await hybridTokenService.cleanupExpired();
        console.log(`🧹 Cleanup completed: ${results.tokensRemoved} expired tokens removed`);
      } catch (error) {
        console.error('Error during token cleanup:', error);
      }
    }, cleanupInterval);
    
    // Also run cleanup on startup
    setTimeout(async () => {
      try {
        const results = await hybridTokenService.cleanupExpired();
        console.log(`🧹 Startup cleanup: ${results.tokensRemoved} expired tokens removed`);
      } catch (error) {
        console.error('Error during startup cleanup:', error);
      }
    }, 10000); // Wait 10 seconds after startup
  }

  /**
   * Create Stripe products and prices for all subscription tiers
   * This should be run once during deployment
   */
  async initializeStripeProducts(): Promise<void> {
    try {
      for (const tier of SUBSCRIPTION_TIERS) {
        if (tier.id === 'free') continue; // Skip free tier

        // Create or update product
        const productId = `readmyfineprint_${tier.id}`;
        let product: Stripe.Product;

        try {
          product = await stripe.products.retrieve(productId);
        } catch (error) {
          // Product doesn't exist, create it
          product = await stripe.products.create({
            id: productId,
            name: `ReadMyFinePrint ${tier.name}`,
            description: tier.description,
            metadata: {
              tierId: tier.id,
              model: tier.model,
              documentsPerMonth: tier.limits.documentsPerMonth.toString(),
            },
          });
        }

                // Create monthly price
        const monthlyPriceId = `${productId}_monthly`;
        try {
          await stripe.prices.retrieve(monthlyPriceId);
        } catch (error) {
          await stripe.prices.create({
            product: product.id,
            unit_amount: tier.monthlyPrice * 100, // Convert to cents
            currency: 'usd',
            recurring: {
              interval: 'month',
            },
            metadata: {
              tierId: tier.id,
              billingCycle: 'monthly',
            },
          });
        }

        // Create yearly price
        const yearlyPriceId = `${productId}_yearly`;
        try {
          await stripe.prices.retrieve(yearlyPriceId);
        } catch (error) {
          const createdYearlyPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: tier.yearlyPrice * 100, // Convert to cents
            currency: 'usd',
            recurring: {
              interval: 'year',
            },
            metadata: {
              tierId: tier.id,
              billingCycle: 'yearly',
            },
          });
        }
      }

      console.log('✅ Stripe products and prices initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Stripe products:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<{
    subscription: Stripe.Subscription;
    userSubscription: UserSubscription;
  }> {
    const { userId, tierId, email, paymentMethodId, billingCycle } = params;

    const tier = getTierById(tierId);
    if (!tier) {
      throw new Error(`Invalid tier ID: ${tierId}`);
    }

    if (tier.id === 'free') {
      throw new Error('Cannot create paid subscription for free tier');
    }

    try {
      // Create or retrieve customer
      let customer: Stripe.Customer;
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: email,
          metadata: {
            userId: userId,
          },
        });
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription
      const priceId = `readmyfineprint_${tierId}_${billingCycle}`;
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: userId,
          tierId: tierId,
          model: tier.model,
        },
      });

      // Create user subscription record
      const userSubscription: UserSubscription = {
        id: subscription.id,
        userId: userId,
        tierId: tierId,
        status: subscription.status as any,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_CREATED' as any,
        severity: 'LOW' as any,
        message: `New subscription created for user ${userId}, tier: ${tierId}`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'subscription-service',
        details: {
          userId,
          tierId,
          subscriptionId: subscription.id,
          billingCycle,
        },
      });

      return { subscription, userSubscription };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a Stripe subscription (Stripe API call)
   */
  async cancelStripeSubscription(subscriptionId: string, immediate: boolean = false): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediate,
        ...(immediate && { cancel_at: Math.floor(Date.now() / 1000) }),
      });

      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_CANCELED' as any,
        severity: 'LOW' as any,
        message: `Subscription ${subscriptionId} canceled (immediate: ${immediate})`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'subscription-service',
        details: {
          subscriptionId,
          immediate,
        },
      });

      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(
    subscriptionId: string,
    newTierId: string,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<Stripe.Subscription> {
    const newTier = getTierById(newTierId);
    if (!newTier || newTier.id === 'free') {
      throw new Error(`Invalid tier ID: ${newTierId}`);
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const newPriceId = `readmyfineprint_${newTierId}_${billingCycle}`;

      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          ...subscription.metadata,
          tierId: newTierId,
          model: newTier.model,
        },
      });

      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_UPDATED' as any,
        severity: 'LOW' as any,
        message: `Subscription ${subscriptionId} updated to tier ${newTierId}`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'subscription-service',
        details: {
          subscriptionId,
          newTierId,
          billingCycle,
        },
      });

      return updatedSubscription;
    } catch (error) {
      console.error('Error updating subscription tier:', error);
      throw error;
    }
  }

  /**
   * Get user's current subscription and usage
   */
  async getUserSubscriptionWithUsage(userId: string): Promise<{
    subscription?: UserSubscription;
    tier: SubscriptionTier;
    usage: SubscriptionUsage;
    canUpgrade: boolean;
    suggestedUpgrade?: SubscriptionTier;
  }> {
    try {
      // Handle anonymous/session users by routing through collective free tier user
      if (userId === "anonymous" || userId.startsWith('session_')) {
        const collectiveUserId = '00000000-0000-0000-0000-000000000001';
        
        // Get collective user's subscription (should be free tier)
        const collectiveSubscription = await databaseStorage.getUserSubscription(collectiveUserId);
        const tier = this.validateAndAssignTier(collectiveSubscription) || this.getFreeTier();
        
        // Get collective usage for current period
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const collectiveUsageRecord = await databaseStorage.getUserUsage(collectiveUserId, currentPeriod);
        
        const usage: SubscriptionUsage = {
          documentsAnalyzed: collectiveUsageRecord?.documentsAnalyzed || 0,
          tokensUsed: collectiveUsageRecord?.tokensUsed || 0,
          cost: parseFloat(collectiveUsageRecord?.cost || '0'),
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };

        console.log(`📊 Anonymous user routed through collective free tier (${usage.documentsAnalyzed} docs used this month)`);

        return {
          subscription: collectiveSubscription,
          tier,
          usage,
          canUpgrade: false,
          suggestedUpgrade: undefined,
        };
      }

      // Get user to verify they exist (only for authenticated users)
      const user = await databaseStorage.getUser(userId);
      if (!user) {
        // Fall back to free tier for unknown users
        console.log(`User ${userId} not found in database, using free tier`);
        const tier = this.getFreeTier();
        const usage: SubscriptionUsage = {
          documentsAnalyzed: 0,
          tokensUsed: 0,
          cost: 0,
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };

        return {
          tier,
          usage,
          canUpgrade: false,
          suggestedUpgrade: undefined,
        };
      }

      // Get user's current subscription, create inactive free tier if none exists
      const subscription = await this.ensureUserHasSubscription(userId);

      // Determine tier with proper subscription validation
      const tier = this.validateAndAssignTier(subscription);

      // Get current period usage
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const usageRecord = await databaseStorage.getUserUsage(userId, currentPeriod);

      // Calculate usage data
      const usage: SubscriptionUsage = {
        documentsAnalyzed: usageRecord?.documentsAnalyzed || 0,
        tokensUsed: usageRecord?.tokensUsed || 0,
        cost: parseFloat(usageRecord?.cost || '0'),
        resetDate: subscription
          ? subscription.currentPeriodEnd
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now for free users
      };

      // Determine upgrade suggestions
      const canUpgrade = this.shouldSuggestUpgrade(tier, usage);
      const suggestedUpgrade = canUpgrade ? this.getSuggestedUpgrade(tier) : undefined;

      return {
        subscription,
        tier,
        usage,
        canUpgrade,
        suggestedUpgrade,
      };
    } catch (error) {
      console.error('Error getting user subscription:', error);
      // Fallback to free tier
      const tier = SUBSCRIPTION_TIERS[0];
      const usage: SubscriptionUsage = {
        documentsAnalyzed: 0,
        tokensUsed: 0,
        cost: 0,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      return {
        tier,
        usage,
        canUpgrade: false,
        suggestedUpgrade: undefined,
      };
    }
  }

  /**
   * Validate subscription status and assign appropriate tier
   * Ensures non-subscribers get free tier and subscribers get paid tiers only
   */
  private validateAndAssignTier(subscription?: UserSubscription): SubscriptionTier {
    // If no subscription exists, user is definitely free tier
    if (!subscription) {
      return this.getFreeTier();
    }

    // Check if subscription is in a valid state for paid access
    const validPaidStatuses = ['active', 'trialing'];
    const isValidPaidSubscription = validPaidStatuses.includes(subscription.status);
    
    // Check if this is a free tier subscription
    const isFreeSubscription = subscription.status === 'free_tier' || subscription.status === 'inactive';

    // Check if subscription is expired
    const now = new Date();
    const isExpired = subscription.currentPeriodEnd < now;

    // If subscription is not active/trialing and not free_tier, or is expired, downgrade to free tier
    if ((!isValidPaidSubscription && !isFreeSubscription) || isExpired) {
      console.log(`[Subscription Enforcement] User downgraded to free tier. Status: ${subscription.status}, Expired: ${isExpired}`);
      return this.getFreeTier();
    }

    // Get the requested tier from subscription
    const requestedTier = getTierById(subscription.tierId);

    // If tier doesn't exist, default to free (except for ultimate which should always work)
    if (!requestedTier) {
      if (subscription.tierId === 'ultimate') {
        console.error(`[CRITICAL] Ultimate tier not found in tier definitions! Creating fallback.`);
        // Return a fallback ultimate tier
        return {
          id: 'ultimate',
          name: 'Ultimate',
          description: 'God mode - unlimited access',
          model: 'gpt-4o',
          monthlyPrice: 0,
          yearlyPrice: 0,
          features: ['Unlimited everything'],
          limits: {
            documentsPerMonth: -1,
            tokensPerDocument: -1,
            prioritySupport: true,
            advancedAnalysis: true,
            apiAccess: true,
            customIntegrations: true,
          },
          modelCosts: {
            inputTokenCost: 2.50,
            outputTokenCost: 10.00,
            estimatedTokensPerDocument: 32000,
            costPerDocument: 0.00,
          },
          popular: false
        };
      }
      console.warn(`[Subscription Enforcement] Invalid tier ID: ${subscription.tierId}, defaulting to free`);
      return this.getFreeTier();
    }

    // Prevent free tier assignment to paying customers (but allow for free_tier status)
    if (requestedTier.id === 'free' && isValidPaidSubscription && !isFreeSubscription) {
      console.log(`[Subscription Enforcement] Preventing free tier assignment to active subscriber, upgrading to starter`);
      return this.getStarterTier();
    }

    console.log(`[Subscription Enforcement] Valid subscription: ${requestedTier.name} tier assigned`);
    return requestedTier;
  }

  /**
   * Get the default/free tier (for non-subscribers)
   */
  private getFreeTier(): SubscriptionTier {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === 'free') || SUBSCRIPTION_TIERS[0];
  }

  /**
   * Create an inactive free tier subscription for a user
   */
  async createInactiveFreeSubscription(userId: string): Promise<UserSubscription> {
    const now = new Date();
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

    const freeSubscription: InsertUserSubscription = {
      userId: userId,
      tierId: 'free',
      status: 'inactive',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: now,
      currentPeriodEnd: futureDate,
      cancelAtPeriodEnd: false,
    };

    const createdSubscription = await databaseStorage.createUserSubscription(freeSubscription);
    
    securityLogger.logSecurityEvent({
      eventType: 'SUBSCRIPTION_CREATED' as any,
      severity: 'LOW' as any,
      message: `Inactive free tier subscription created for user ${userId}`,
      ip: 'system',
      userAgent: 'subscription-service',
      endpoint: 'subscription-service',
      details: {
        userId,
        tierId: 'free',
        status: 'inactive',
      },
    });

    return createdSubscription;
  }

  /**
   * Ensure the collective free tier user exists for usage tracking
   */
  async ensureCollectiveFreeUserExists(): Promise<void> {
    try {
      const collectiveUserId = '00000000-0000-0000-0000-000000000001';

      // Check if collective user already exists
      const existingUser = await databaseStorage.getUser(collectiveUserId);

      if (!existingUser) {
        // Create the collective free tier user
        await databaseStorage.createUserWithId(collectiveUserId, {
          email: 'collective.free.tier@internal.system',
          username: 'collective_free_tier',
          hashedPassword: null, // No password for system user
          stripeCustomerId: null,
        });

        // Create inactive free tier subscription for collective user
        await this.createInactiveFreeSubscription(collectiveUserId);

        console.log(`✅ Created collective free tier user with inactive subscription for usage tracking`);
      } else {
        // Ensure collective user has an inactive subscription
        const existingSubscription = await databaseStorage.getUserSubscription(collectiveUserId);
        if (!existingSubscription) {
          await this.createInactiveFreeSubscription(collectiveUserId);
          console.log(`✅ Created inactive subscription for existing collective free tier user`);
        }
      }
    } catch (error) {
      console.error('Error ensuring collective free user exists:', error);
      // Don't throw - this shouldn't break the main flow
    }
  }

  /**
   * Ensure a user has a subscription record (create inactive free tier if none exists)
   */
  async ensureUserHasSubscription(userId: string): Promise<UserSubscription> {
    const existingSubscription = await databaseStorage.getUserSubscription(userId);
    
    if (!existingSubscription) {
      console.log(`Creating inactive free tier subscription for user: ${userId}`);
      return await this.createInactiveFreeSubscription(userId);
    }
    
    return existingSubscription;
  }

  /**
   * Get the starter tier (minimum paid tier)
   */
  private getStarterTier(): SubscriptionTier {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === 'starter') || SUBSCRIPTION_TIERS[1];
  }

  /**
   * Audit and fix subscription tier mismatches
   * This method can be called periodically to ensure data integrity
   */
  async auditSubscriptionTiers(): Promise<{
    totalUsers: number;
    fixedMismatches: number;
    freeUsersCount: number;
    paidUsersCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let fixedMismatches = 0;
    let freeUsersCount = 0;
    let paidUsersCount = 0;

    try {
      // Get all users with their subscription data
      const users = await databaseStorage.getAllUsers();

      console.log(`[Subscription Audit] Starting audit of ${users.length} users`);

      for (const user of users) {
        const subscription = await databaseStorage.getUserSubscription(user.id);
        const originalTier = subscription
          ? getTierById(subscription.tierId) 
          : this.getFreeTier();

        const validatedTier = this.validateAndAssignTier(subscription);

        // Check for tier mismatches
        if (originalTier?.id !== validatedTier.id) {
          console.log(`[Subscription Audit] Mismatch found for user ${user.id}: ${originalTier?.id} -> ${validatedTier.id}`);

          // If there's a subscription record but it should be free tier
          if (subscription && validatedTier.id === 'free') {
            const reason = this.getDemotionReason(subscription);
            issues.push(`User ${user.id}: Downgraded from ${originalTier?.id} to free (${reason})`);
          }

          // If there's an active subscription but assigned free tier incorrectly
          else if (subscription && originalTier?.id === 'free' && validatedTier.id !== 'free') {
            issues.push(`User ${user.id}: Upgraded from free to ${validatedTier.id} (has active subscription)`);
          }

          fixedMismatches++;
        }

        // Count final tier assignments
        if (validatedTier.id === 'free') {
          freeUsersCount++;
        } else {
          paidUsersCount++;
        }
      }

      console.log(`[Subscription Audit] Completed. Fixed ${fixedMismatches} mismatches.`);

      return {
        totalUsers: users.length,
        fixedMismatches,
        freeUsersCount,
        paidUsersCount,
        issues
      };

    } catch (error) {
      console.error('[Subscription Audit] Error during audit:', error);
      issues.push(`Audit error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        totalUsers: 0,
        fixedMismatches: 0,
        freeUsersCount: 0,
        paidUsersCount: 0,
        issues
      };
    }
  }

  /**
   * Get reason for subscription demotion to free tier
   */
  private getDemotionReason(subscription: UserSubscription): string {
    const validPaidStatuses = ['active', 'trialing'];
    const isValidStatus = validPaidStatuses.includes(subscription.status);
    const isExpired = subscription.currentPeriodEnd < new Date();

    if (!isValidStatus && isExpired) {
      return `status: ${subscription.status}, expired`;
    } else if (!isValidStatus) {
      return `status: ${subscription.status}`;
    } else if (isExpired) {
      return 'expired';
    } else {
      return 'unknown';
    }
  }

  /**
   * Validate that a user's assigned tier matches their subscription status
   * Returns true if valid, false if there's a mismatch
   */
  async validateUserTier(userId: string): Promise<{
    isValid: boolean;
    currentTier: string;
    shouldBeTier: string;
    reason?: string;
  }> {
    try {
      const subscription = await databaseStorage.getUserSubscription(userId);
      const currentTier = subscription
        ? getTierById(subscription.tierId)?.id || 'free'
        : 'free';

      const validatedTier = this.validateAndAssignTier(subscription);
      const shouldBeTier = validatedTier.id;

      const isValid = currentTier === shouldBeTier;

      return {
        isValid,
        currentTier,
        shouldBeTier,
        reason: !isValid && subscription 
          ? this.getDemotionReason(subscription)
          : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        currentTier: 'unknown',
        shouldBeTier: 'free',
        reason: `Error validating user: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Track document analysis usage
   */
  async trackUsage(userId: string, tokensUsed: number, model: string): Promise<void> {
    try {
      // Route anonymous/session users through collective free tier user
      let trackingUserId = userId;
      
      if (userId === "anonymous" || userId.startsWith('session_')) {
        trackingUserId = '00000000-0000-0000-0000-000000000001';
        console.log(`📊 Routing anonymous usage tracking through collective free tier user`);
      } else {
        // Check if authenticated user exists in database
        const userExists = await databaseStorage.userExists(userId);
        if (!userExists) {
          console.log(`📊 User ${userId} not in database, routing through collective free tier for usage tracking`);
          trackingUserId = '00000000-0000-0000-0000-000000000001';
        }
      }

      // Get user's current subscription to determine tier with validation
      const subscription = await databaseStorage.getUserSubscription(trackingUserId);
      const tier = this.validateAndAssignTier(subscription);

      const cost = this.calculateTokenCost(tokensUsed, tier);
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format

      // Get or create usage record for current period
      let usageRecord = await databaseStorage.getUserUsage(trackingUserId, currentPeriod);

      if (usageRecord) {
        // Update existing usage record
        await databaseStorage.updateUsageRecord(usageRecord.id, {
          documentsAnalyzed: usageRecord.documentsAnalyzed + 1,
          tokensUsed: usageRecord.tokensUsed + tokensUsed,
          cost: (parseFloat(usageRecord.cost) + cost).toString(),
        });
      } else {
        // Create new usage record
        await databaseStorage.createUsageRecord({
          userId: trackingUserId,
          subscriptionId: subscription?.id,
          period: currentPeriod,
          documentsAnalyzed: 1,
          tokensUsed,
          cost: cost.toString(),
        });
      }

      const userType = trackingUserId === '00000000-0000-0000-0000-000000000001' ? 'collective free tier' : 'authenticated user';
      console.log(`✅ Usage tracked for ${userType} (${trackingUserId}): +1 document, +${tokensUsed} tokens, +$${cost.toFixed(6)}`);
    } catch (error) {
      console.error('Error tracking usage:', error);
      // Don't throw - usage tracking failures shouldn't break document analysis
    }
  }

  /**
   * Calculate cost for token usage based on tier
   */
  private calculateTokenCost(tokensUsed: number, tier: SubscriptionTier): number {
    // Assume 60/40 split between input and output tokens
    const inputTokens = Math.floor(tokensUsed * 0.6);
    const outputTokens = Math.floor(tokensUsed * 0.4);

    const inputCost = (inputTokens / 1_000_000) * tier.modelCosts.inputTokenCost;
    const outputCost = (outputTokens / 1_000_000) * tier.modelCosts.outputTokenCost;

    return inputCost + outputCost;
  }

  /**
   * Determine if user should be suggested to upgrade
   */
  private shouldSuggestUpgrade(tier: SubscriptionTier, usage: SubscriptionUsage): boolean {
    // Don't suggest upgrade for unlimited free tier
    if (tier.limits.documentsPerMonth === -1) return false;

    // Don't suggest upgrade for highest tier
    if (tier.id === 'enterprise') return false;

    // Suggest upgrade if user is at 80% of their limit
    return usage.documentsAnalyzed >= tier.limits.documentsPerMonth * 0.8;
  }

  /**
   * Get suggested upgrade tier for current tier
   */
  private getSuggestedUpgrade(currentTier: SubscriptionTier): SubscriptionTier | undefined {
    const currentIndex = SUBSCRIPTION_TIERS.findIndex(t => t.id === currentTier.id);
    if (currentIndex === -1 || currentIndex >= SUBSCRIPTION_TIERS.length - 1) {
      return undefined;
    }
    return SUBSCRIPTION_TIERS[currentIndex + 1];
  }

  /**
   * Handle Stripe webhooks
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled Stripe webhook event: ${event.type}`);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) {
        console.error('No userId in subscription metadata:', subscription.id);
        return;
      }

      // Update subscription in database
      await databaseStorage.updateUserSubscription(subscription.id, {
        status: subscription.status as any,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        stripeCustomerId: subscription.customer as string,
      });

      console.log('✅ Subscription updated in database:', subscription.id);
    } catch (error) {
      console.error('❌ Error updating subscription:', subscription.id, error);
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) {
        console.error('No userId in subscription metadata:', subscription.id);
        return;
      }

      // Mark subscription as canceled in database
      await databaseStorage.updateUserSubscription(subscription.id, {
        status: 'canceled',
        cancelAtPeriodEnd: true,
      });

      console.log('✅ Subscription canceled in database:', subscription.id);

      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_CANCELED' as any,
        severity: 'LOW' as any,
        message: `Subscription deleted via webhook: ${subscription.id}`,
        ip: 'stripe-webhook',
        userAgent: 'stripe-webhook',
        endpoint: 'subscription-webhook',
        details: {
          userId,
          subscriptionId: subscription.id,
        },
      });
    } catch (error) {
      console.error('❌ Error handling subscription deletion:', subscription.id, error);
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      const subscriptionId = (invoice as any).subscription as string;
      if (!subscriptionId) {
        console.log('No subscription ID in invoice:', invoice.id);
        return;
      }

      // Get subscription to find user
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata.userId;

      if (!userId) {
        console.error('No userId in subscription metadata for invoice:', invoice.id);
        return;
      }

      console.log('✅ Payment succeeded for user:', userId, 'invoice:', invoice.id);

      securityLogger.logSecurityEvent({
        eventType: 'PAYMENT_SUCCEEDED' as any,
        severity: 'LOW' as any,
        message: `Payment succeeded for invoice: ${invoice.id}`,
        ip: 'stripe-webhook',
        userAgent: 'stripe-webhook',
        endpoint: 'subscription-webhook',
        details: {
          userId,
          subscriptionId,
          invoiceId: invoice.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
        },
      });
    } catch (error) {
      console.error('❌ Error handling payment success:', invoice.id, error);
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      const subscriptionId = (invoice as any).subscription as string;
      if (!subscriptionId) {
        console.log('No subscription ID in failed invoice:', invoice.id);
        return;
      }

      // Get subscription to find user
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata.userId;

      if (!userId) {
        console.error('No userId in subscription metadata for failed invoice:', invoice.id);
        return;
      }

      console.log('❌ Payment failed for user:', userId, 'invoice:', invoice.id);

      securityLogger.logSecurityEvent({
        eventType: 'PAYMENT_FAILED' as any,
        severity: 'MEDIUM' as any,
        message: `Payment failed for invoice: ${invoice.id}`,
        ip: 'stripe-webhook',
        userAgent: 'stripe-webhook',
        endpoint: 'subscription-webhook',
        details: {
          userId,
          subscriptionId,
          invoiceId: invoice.id,
          amount: invoice.amount_due / 100,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count,
        },
      });

      // TODO: Send notification email to user about failed payment
      // TODO: Consider restricting usage if payment fails repeatedly
    } catch (error) {
      console.error('❌ Error handling payment failure:', invoice.id, error);
    }
  }

  /**
   * Create a subscription user (for anonymous users who subscribe)
   * Uses minimal PII and sanitized identifiers
   */
  async createSubscriptionUser(params: {
    stripeCustomerId: string;
    tierId: string;
    email: string; // Sanitized internal email, not customer PII
    source: string;
  }): Promise<string> {
    try {
      // Check if user with this email already exists
      const existingUser = await databaseStorage.getUserByEmail(params.email);
      
      if (existingUser) {
        console.log(`Found existing user ${existingUser.id} with email ${params.email} for Stripe customer ${params.stripeCustomerId}`);
        return existingUser.id;
      }

      // If email is a real customer email (not sanitized), create unique internal email
      let finalEmail = params.email;
      if (!params.email.includes('@subscription.internal')) {
        // Create a unique internal email to avoid conflicts
        const timestamp = Date.now();
        finalEmail = `subscriber_${params.stripeCustomerId}_${timestamp}@subscription.internal`;
        console.log(`Using unique internal email: ${finalEmail} for customer email: ${params.email}`);
      }

      // Create a minimal user record for subscription tracking
      const user = await databaseStorage.createUser({
        email: finalEmail,
        username: `subscriber_${params.stripeCustomerId.slice(-8)}_${Date.now()}`, // Unique username
        hashedPassword: crypto.randomBytes(32).toString('hex'), // Random password, can't be used to login
      });

      console.log(`Created subscription user ${user.id} for Stripe customer ${params.stripeCustomerId}`);
      return user.id;
    } catch (error) {
      console.error('Error creating subscription user:', error);
      
      // If it's still a duplicate constraint error, try one more time with a unique email
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
        try {
          const uniqueEmail = `subscriber_${params.stripeCustomerId}_${Date.now()}_${Math.random().toString(36).slice(2)}@subscription.internal`;
          const user = await databaseStorage.createUser({
            email: uniqueEmail,
            username: `subscriber_${params.stripeCustomerId.slice(-8)}_${Date.now()}`,
            hashedPassword: crypto.randomBytes(32).toString('hex'),
          });
          
          console.log(`Created subscription user ${user.id} with unique email after retry`);
          return user.id;
        } catch (retryError) {
          console.error('Failed to create user even with unique email:', retryError);
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Create a Stripe subscription record in the database
   */
  async createStripeSubscription(params: {
    userId: string;
    tierId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    billingCycle: string;
    status: string;
  }): Promise<UserSubscription> {
    try {
      // Calculate period dates (30 days for monthly, 365 for yearly)
      const now = new Date();
      const periodLength = params.billingCycle === 'yearly' ? 365 : 30;
      const periodEnd = new Date(now.getTime() + periodLength * 24 * 60 * 60 * 1000);

      const subscriptionData: InsertUserSubscription = {
        userId: params.userId,
        tierId: params.tierId,
        status: params.status as any,
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      };

      // First, cancel any existing subscriptions for this user
      const existingSubscription = await databaseStorage.getUserSubscription(params.userId);
      if (existingSubscription) {
        await databaseStorage.updateUserSubscription(existingSubscription.id, {
          status: 'canceled'
        });
      }

      const subscription = await databaseStorage.createUserSubscription(subscriptionData);
      console.log(`Created subscription ${subscription.id} for user ${params.userId}`);
      return subscription;
    } catch (error) {
      console.error('Error creating Stripe subscription:', error);
      throw error;
    }
  }

  /**
   * Sync subscription data from Stripe webhooks
   */
  async syncStripeSubscription(params: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  }): Promise<void> {
    try {
      // Find subscription by Stripe subscription ID
      const subscriptions = await databaseStorage.getAllUserSubscriptions();
      const subscription = subscriptions.find(sub => 
        sub.stripeSubscriptionId === params.stripeSubscriptionId
      );

      if (!subscription) {
        console.warn(`No local subscription found for Stripe subscription ${params.stripeSubscriptionId}`);
        return;
      }

      // Update the subscription with Stripe data
      await databaseStorage.updateUserSubscription(subscription.id, {
        status: params.status as any,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd
      });

      console.log(`Synced subscription ${subscription.id} with Stripe data`);
    } catch (error) {
      console.error('Error syncing Stripe subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userId: string, immediate: boolean = false): Promise<void> {
    try {
      const subscription = await databaseStorage.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found to cancel');
      }

      const updates: Partial<InsertUserSubscription> = {
        cancelAtPeriodEnd: !immediate
      };

      if (immediate) {
        updates.status = 'canceled';
        updates.currentPeriodEnd = new Date(); // End immediately
      }

      await databaseStorage.updateUserSubscription(subscription.id, updates);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Reactivate a cancelled subscription (remove cancel_at_period_end)
   */
  async reactivateSubscription(userId: string): Promise<void> {
    try {
      const subscription = await databaseStorage.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found to reactivate');
      }

      if (!subscription.cancelAtPeriodEnd) {
        throw new Error('Subscription is not cancelled');
      }

      const updates: Partial<InsertUserSubscription> = {
        cancelAtPeriodEnd: false
      };

      await databaseStorage.updateUserSubscription(subscription.id, updates);
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  /**
   * Generate a secure subscription access token with device binding
   * This token is bound to device characteristics for enhanced security
   */
  async generateSubscriptionToken(userId: string, subscriptionId: string, deviceFingerprint?: string): Promise<string> {
    try {
      // Get user's subscription to determine tier
      const subscription = await databaseStorage.getUserSubscription(userId);
      const tier = this.validateAndAssignTier(subscription);
      
      // Use hybrid token service (prefers JOSE, falls back to PostgreSQL)
      const token = await hybridTokenService.generateSubscriptionToken({
        userId,
        subscriptionId,
        tierId: tier.id,
        deviceFingerprint: deviceFingerprint || 'unknown'
      });
      
      console.log(`Generated secure subscription token for user ${userId} (expires in 30 days)`);
      return token;
    } catch (error) {
      console.error('Error generating subscription token:', error);
      throw error;
    }
  }

  /**
   * Validate a subscription token with enhanced security checks
   */
  async validateSubscriptionToken(token: string, deviceFingerprint?: string, clientIp?: string): Promise<{
    subscription?: UserSubscription;
    tier: SubscriptionTier;
    usage: SubscriptionUsage;
    canUpgrade: boolean;
    suggestedUpgrade?: SubscriptionTier;
  } | null> {
    try {
      // Support both JOSE tokens (start with 'eyJ') and legacy PostgreSQL tokens (start with 'sub_')
      if (!token.startsWith('sub_') && !token.startsWith('eyJ')) {
        console.warn('Invalid token format - must be JOSE (eyJ*) or legacy (sub_*)');
        return null;
      }
      
      // Get token data from hybrid service (supports both JOSE and PostgreSQL)
      const tokenData = await hybridTokenService.validateSubscriptionToken(token);
      if (!tokenData) {
        console.warn('Token not found in storage');
        return null;
      }
      
      // Basic device fingerprint logging (simplified for PostgreSQL storage)
      if (deviceFingerprint && deviceFingerprint !== 'unknown') {
        console.log(`Token used from device: ${deviceFingerprint.slice(0, 16)}... for user ${tokenData.userId}`);
      }
      
      // Rate limiting: Check usage frequency (PostgreSQL tokens only)
      if (token.startsWith('sub_') && tokenData.lastUsed && tokenData.usageCount) {
        const now = new Date();
        const lastUsed = new Date(tokenData.lastUsed);
        const timeSinceLastUse = now.getTime() - lastUsed.getTime();
        
        // If used more than 100 times in last hour, it might be automated/shared
        if (tokenData.usageCount > 100 && timeSinceLastUse < 60 * 60 * 1000) {
          console.warn('Potential token abuse detected - high usage frequency');
          securityLogger.logSecurityEvent({
            eventType: 'SECURITY_VIOLATION' as any,
            severity: 'MEDIUM' as any,
            message: 'Subscription token showing unusual usage patterns',
            ip: clientIp || 'unknown',
            userAgent: 'subscription-service',
            endpoint: 'token-validation',
            details: {
              tokenId: token.slice(0, 16) + '...',
              usageCount: tokenData.usageCount,
              lastUsed: tokenData.lastUsed
            }
          });
        }
      }
      
      // Update usage tracking in hybrid service (PostgreSQL tokens only)
      await hybridTokenService.updateTokenUsage(token);
      
      // Get current subscription data and verify it's still active
      const subscriptionData = await this.getUserSubscriptionWithUsage(tokenData.userId);
      
      // Double-check that the subscription is still active
      if (subscriptionData.subscription && subscriptionData.subscription.status !== 'active') {
        console.warn('Token valid but subscription no longer active');
        // Invalidate the token
        await hybridTokenService.revokeToken(token, 'subscription no longer active');
        return null;
      }
      
      return subscriptionData;
    } catch (error) {
      console.error('Error validating subscription token:', error);
      return null;
    }
  }

  /**
   * Store mapping from checkout session to subscription token
   * Using simple in-memory mapping for session -> token mapping
   */
  private sessionTokenMap = new Map<string, string>();
  
  async storeSessionToken(sessionId: string, token: string): Promise<void> {
    this.sessionTokenMap.set(sessionId, token);
    console.log(`Stored session token mapping for session ${sessionId}`);
    
    // Clean up after 1 hour
    setTimeout(() => {
      this.sessionTokenMap.delete(sessionId);
    }, 60 * 60 * 1000);
  }

  /**
   * Get subscription token by checkout session ID
   */
  async getTokenBySession(sessionId: string): Promise<string | null> {
    return this.sessionTokenMap.get(sessionId) || null;
  }

  /**
   * Revoke a subscription token (for security incidents)
   */
  async revokeSubscriptionToken(token: string, reason: string): Promise<boolean> {
    try {
      if (!token || token.length < 10) {
        return false;
      }
      
      // Get token data before removal
      const tokenInfo = await hybridTokenService.getTokenInfo(token);
      if (!tokenInfo) {
        return false;
      }
      
      // Log the revocation
      securityLogger.logSecurityEvent({
        eventType: 'TOKEN_REVOKED' as any,
        severity: 'MEDIUM' as any,
        message: `Subscription token revoked: ${reason}`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'token-revocation',
        details: {
          tokenId: token.slice(0, 16) + '...',
          userId: tokenInfo.userId,
          reason
        }
      });
      
      // Remove from hybrid service
      const success = await hybridTokenService.revokeToken(token, reason);
      if (success) {
        console.log(`Revoked subscription token for user ${tokenInfo.userId}: ${reason}`);
      }
      
      return success;
    } catch (error) {
      console.error('Error revoking subscription token:', error);
      return false;
    }
  }

  /**
   * Revoke all tokens for a specific user
   */
  async revokeAllUserTokens(userId: string, reason: string): Promise<number> {
    try {
      // Remove all tokens for the user from hybrid service
      const revokedCount = await hybridTokenService.revokeAllUserTokens(userId, reason);
      
      if (revokedCount > 0) {
        securityLogger.logSecurityEvent({
          eventType: 'ALL_TOKENS_REVOKED' as any,
          severity: 'HIGH' as any,
          message: `All subscription tokens revoked for user: ${reason}`,
          ip: 'system',
          userAgent: 'subscription-service',
          endpoint: 'token-revocation',
          details: {
            userId,
            revokedCount,
            reason
          }
        });
        
        console.log(`Revoked ${revokedCount} tokens for user ${userId}: ${reason}`);
      }
      
      return revokedCount;
    } catch (error) {
      console.error('Error revoking all user tokens:', error);
      return 0;
    }
  }

  // Token storage now handled by Hybrid Service
  // Supports both JOSE (preferred) and PostgreSQL (legacy) tokens
}

export const subscriptionService = new SubscriptionService();

/**
 * Utility function to check if user can analyze another document
 */
export function canUserAnalyzeDocument(subscription: UserSubscription, currentUsage: SubscriptionUsage): boolean {
  const tier = getTierById(subscription.tierId);
  if (!tier) return false;

  // Allow unlimited documents for free tier or any tier with -1 limit
  if (tier.limits.documentsPerMonth === -1) return true;

  // For paid tiers, check against the limit
  return currentUsage.documentsAnalyzed < tier.limits.documentsPerMonth;
}