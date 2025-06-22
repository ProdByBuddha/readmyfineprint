import Stripe from 'stripe';
import type { UserSubscription, SubscriptionTier, User, InsertUserSubscription, UsageRecord, InsertUsageRecord } from '@shared/schema';
import { SUBSCRIPTION_TIERS, getTierById } from './subscription-tiers';
import { securityLogger } from './security-logger';
import { databaseStorage } from './storage';

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
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, immediate: boolean = false): Promise<Stripe.Subscription> {
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

      // Get user's current subscription
      const subscription = await databaseStorage.getUserSubscription(userId);

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

    // Check if subscription is expired
    const now = new Date();
    const isExpired = subscription.currentPeriodEnd < now;

    // If subscription is not active or is expired, downgrade to free tier
    if (!isValidPaidSubscription || isExpired) {
      console.log(`[Subscription Enforcement] User downgraded to free tier. Status: ${subscription.status}, Expired: ${isExpired}`);
      return this.getFreeTier();
    }

    // Get the requested tier from subscription
    const requestedTier = getTierById(subscription.tierId);

    // If tier doesn't exist, default to free
    if (!requestedTier) {
      console.warn(`[Subscription Enforcement] Invalid tier ID: ${subscription.tierId}, defaulting to free`);
      return this.getFreeTier();
    }

    // Prevent free tier assignment to paying customers (except collective user)
    if (requestedTier.id === 'free' && isValidPaidSubscription && subscription.userId !== '00000000-0000-0000-0000-000000000001') {
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
   * Ensure the collective free tier user exists for usage tracking
   */
  async ensureCollectiveFreeUserExists(): Promise<void> {
    try {
      const collectiveUserId = '00000000-0000-0000-0000-000000000001';

      // Check if collective user already exists
      const existingUser = await databaseStorage.getUser(collectiveUserId);

      if (!existingUser) {
        // Create the collective free tier user
        await databaseStorage.createUser({
          id: collectiveUserId,
          email: 'collective.free.tier@internal.system',
          username: 'collective_free_tier',
          hashedPassword: null, // No password for system user
          stripeCustomerId: null,
        });

        console.log(`✅ Created collective free tier user for usage tracking`);
      }
    } catch (error) {
      console.error('Error ensuring collective free user exists:', error);
      // Don't throw - this shouldn't break the main flow
    }
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