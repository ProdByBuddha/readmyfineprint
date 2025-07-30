import Stripe from 'stripe';
import crypto from 'crypto';
import type { UserSubscription, SubscriptionTier, User, InsertUserSubscription, UsageRecord, InsertUsageRecord, SecurityQuestionsSetup } from '@shared/schema';
import { SUBSCRIPTION_TIERS, getTierById } from './subscription-tiers';
import { securityLogger } from './security-logger';
import { databaseStorage } from './storage';
import { secureJWTService } from './secure-jwt-service';
import { securityQuestionsService } from './security-questions-service';
import { collectiveUserService } from './collective-user-service';
import { postgresqlSessionStorage } from './postgresql-session-storage';
import { emailService } from './email-service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

interface CreateSubscriptionParams {
  userId: string;
  tierId: string;
  email: string;
  paymentMethodId: string;
  billingCycle: 'monthly' | 'yearly';
  securityQuestions?: SecurityQuestionsSetup;
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
        const tokenResults = await secureJWTService.cleanupExpiredTokens();
        const sessionResults = await postgresqlSessionStorage.cleanupExpired();
        console.log(`🧹 Cleanup completed: ${tokenResults.tokensRemoved} expired tokens removed, ${sessionResults.sessionsRemoved} expired sessions removed`);
      } catch (error) {
        console.error('Error during token cleanup:', error);
      }
    }, cleanupInterval);
    
    // Also run cleanup on startup
    setTimeout(async () => {
      try {
        const tokenResults = await secureJWTService.cleanupExpiredTokens();
        const sessionResults = await postgresqlSessionStorage.cleanupExpired();
        console.log(`🧹 Startup cleanup: ${tokenResults.tokensRemoved} expired tokens removed, ${sessionResults.sessionsRemoved} expired sessions removed`);
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
    const { userId, tierId, email, paymentMethodId, billingCycle, securityQuestions } = params;

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

      // Save security questions if provided
      if (securityQuestions && securityQuestions.questions.length > 0) {
        try {
          await securityQuestionsService.saveSecurityQuestions(userId, securityQuestions);
          console.log(`✅ Security questions saved for user ${userId} during subscription`);
        } catch (error) {
          console.error(`❌ Failed to save security questions for user ${userId}:`, error);
          // Note: We don't fail the subscription creation if security questions fail
          // The user can set them up later
        }
      }

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
          hasSecurityQuestions: !!securityQuestions?.questions.length,
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
   * Update Stripe subscription tier
   */
  async updateStripeSubscriptionTier(
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
      // Special handling for collective free user (admin/system use only)
      if (userId === '00000000-0000-0000-0000-000000000001') {
        const tier = this.getFreeTier();
        return {
          tier,
          usage: {
            documentsAnalyzed: 0,
            tokensUsed: 0,
            cost: 0,
            resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          canUpgrade: false,
          suggestedUpgrade: undefined,
        };
      }

      // Check if userId is invalid or this is a session ID (not a real user) - handle as free tier session user
      if (!userId || userId.length === 32 || userId.includes('session_') || userId.startsWith('test-session-') || !userId.includes('-')) {
        if (!userId) {
          console.warn(`⚠️ getUserSubscriptionWithUsage called with undefined userId`);
        }
        console.log(`📊 Session-based user detected (${userId}), providing free tier without subscription record`);
        const tier = this.getFreeTier();
        
        // For anonymous users, get individual usage from collective user service
        const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
        let individualUsage = 0;
        
        try {
          // Get individual usage from collective user service
          individualUsage = await collectiveUserService.getIndividualMonthlyUsage(userId, currentPeriod);
        } catch (error) {
          console.error('Error getting individual anonymous user usage:', error);
          individualUsage = 0;
        }
        
        const usage = {
          documentsAnalyzed: individualUsage,
          tokensUsed: 0, // Not tracked individually
          cost: 0, // Not tracked individually  
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };
        
        console.log(`📊 Individual anonymous user (${userId}) usage: ${usage.documentsAnalyzed} documents analyzed this month`);
        
        return {
          tier,
          usage,
          canUpgrade: true,
          suggestedUpgrade: this.getStarterTier(),
        };
      }

      // Check if user is admin and handle admin subscription logic
      let isAdmin = false;
      let subscription: UserSubscription | undefined;
      
      try {
        isAdmin = await this.isAdminByEmail(userId);
      } catch (adminCheckError: any) {
        console.error('Error checking admin email:', adminCheckError);
        
        // For known admin user ID, assume admin status during database issues
        if (userId === '24c3ec47-dd61-4619-9c9e-18abbd0981ea') {
          console.log('[Admin Fallback] Using known admin user ID for admin verification during database issue');
          isAdmin = true;
        }
      }
      
      if (isAdmin) {
        // For admin users, ensure they have ultimate tier subscription
        try {
          const existingSubscription = await databaseStorage.getUserSubscription(userId);
          
          if (!existingSubscription || existingSubscription.tierId !== 'ultimate') {
            console.log(`[Admin Setup] Creating/updating ultimate tier subscription for admin user: ${userId}`);
            
            if (existingSubscription && existingSubscription.tierId !== 'ultimate') {
              // Update existing subscription to ultimate tier
              const now = new Date();
              const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
              
              const updatedSubscription = await databaseStorage.updateUserSubscription(existingSubscription.id, {
                tierId: 'ultimate',
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: futureDate,
                cancelAtPeriodEnd: false,
                stripeCustomerId: null, // Admin subscriptions don't use Stripe
                stripeSubscriptionId: null
              });
              
              subscription = updatedSubscription || existingSubscription;
              console.log(`[Admin Setup] Updated existing subscription ${existingSubscription.id} to ultimate tier`);
            } else {
              // Create new ultimate tier subscription
              const ultimateSubscription = await this.createAdminUltimateSubscription(userId);
              subscription = ultimateSubscription || await this.ensureUserHasSubscription(userId);
            }
          } else {
            subscription = existingSubscription;
            console.log(`[Admin Setup] Admin user already has ultimate tier subscription`);
          }
        } catch (subscriptionError: any) {
          console.error('Error managing admin subscription:', subscriptionError);
          
          // Check if this is a database connection issue
          if (subscriptionError.message?.includes('terminating connection') || 
              subscriptionError.cause?.message?.includes('terminating connection') ||
              subscriptionError.code === '57P01') {
            
            console.log('[Admin Fallback] Database connection issue, providing admin tier without subscription record');
            
            // Return admin tier without subscription record during database issues
            const tier = this.getUltimateTier();
            const usage: SubscriptionUsage = {
              documentsAnalyzed: 0,
              tokensUsed: 0,
              cost: 0,
              resetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            };

            return {
              tier,
              usage,
              canUpgrade: false,
              suggestedUpgrade: undefined,
            };
          } else {
            throw subscriptionError; // Re-throw if not a connection issue
          }
        }
      } else {
        // For regular users, get or create subscription normally
        subscription = await this.ensureUserHasSubscription(userId);
      }

      // Determine tier with proper subscription validation
      const tier = await this.validateAndAssignTier(subscription);

      // Get current period usage
      let usageRecord: any = null;
      try {
        const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
        usageRecord = await databaseStorage.getUserUsage(userId, currentPeriod);
      } catch (usageError: any) {
        console.error('Error getting usage record:', usageError);
        
        // For admin users during database issues, provide default usage
        if (isAdmin && (usageError.message?.includes('terminating connection') || 
                       usageError.cause?.message?.includes('terminating connection') ||
                       usageError.code === '57P01')) {
          console.log('[Admin Fallback] Using default usage during database connection issue');
          // usageRecord will remain null and we'll use defaults below
        } else {
          throw usageError; // Re-throw if not a connection issue
        }
      }

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
      
      // Enhanced fallback for admin users
      if (userId === '24c3ec47-dd61-4619-9c9e-18abbd0981ea') {
        console.log('[Admin Emergency Fallback] Providing ultimate tier for known admin during system error');
        const tier = this.getUltimateTier();
        const usage: SubscriptionUsage = {
          documentsAnalyzed: 0,
          tokensUsed: 0,
          cost: 0,
          resetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        };

        return {
          tier,
          usage,
          canUpgrade: false,
          suggestedUpgrade: undefined,
        };
      }
      
      // Fallback to free tier for regular users
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
   * Ultimate tier is restricted to admin users only
   * Admin users automatically get ultimate tier regardless of subscription status
   */
  private async validateAndAssignTier(subscription?: UserSubscription): Promise<SubscriptionTier> {
    // PRIORITY: Check if user is admin - admins always get ultimate tier
    if (subscription) {
      const isAdminUser = await this.isAdminUser(subscription.userId);
      if (isAdminUser) {
        console.log(`[Admin Access] Ultimate tier automatically assigned to admin user: ${subscription.userId}`);
        return this.getUltimateTier();
      }
    }

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

    // If tier doesn't exist, default to free tier
    if (!requestedTier) {
      console.warn(`[Subscription Enforcement] Invalid tier ID: ${subscription.tierId}, defaulting to free tier`);
      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_VALIDATION_FAILED' as any,
        severity: 'HIGH' as any,
        message: `Invalid tier ID attempted: ${subscription.tierId}`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'validateAndAssignTier',
        details: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          attemptedTierId: subscription.tierId,
          subscriptionStatus: subscription.status
        },
      });
      return this.getFreeTier();
    }

    // CRITICAL SECURITY: Ultimate tier is admin-only
    if (requestedTier.id === 'ultimate') {
      const isAdminUser = await this.isAdminUser(subscription.userId);
      if (!isAdminUser) {
        console.error(`[CRITICAL SECURITY] Non-admin user attempted ultimate tier access: ${subscription.userId}`);
        securityLogger.logSecurityEvent({
          eventType: 'SUBSCRIPTION_BYPASS_ATTEMPT' as any,
          severity: 'CRITICAL' as any,
          message: `SECURITY BREACH: Non-admin user attempted ultimate tier access`,
          ip: 'system',
          userAgent: 'subscription-service',
          endpoint: 'validateAndAssignTier',
          details: {
            subscriptionId: subscription.id,
            userId: subscription.userId,
            attemptedTierId: 'ultimate',
            subscriptionStatus: subscription.status,
            isAdmin: false,
            securityViolation: true
          },
        });
        // Force downgrade to free tier for security
        return this.getFreeTier();
      } else {
        console.log(`[Admin Access] Ultimate tier granted to admin user: ${subscription.userId}`);
        securityLogger.logSecurityEvent({
          eventType: 'ADMIN_TIER_ACCESS' as any,
          severity: 'MEDIUM' as any,
          message: `Ultimate tier access granted to admin user`,
          ip: 'system',
          userAgent: 'subscription-service',
          endpoint: 'validateAndAssignTier',
          details: {
            subscriptionId: subscription.id,
            userId: subscription.userId,
            tierId: 'ultimate',
            isAdmin: true,
            adminAccess: true
          },
        });
        return requestedTier;
      }
    }

    // Strict validation: Prevent any unauthorized tier escalation
    if (requestedTier.id !== 'free' && !isValidPaidSubscription) {
      console.warn(`[Subscription Enforcement] Attempted paid tier access without valid subscription. User: ${subscription.userId}, Tier: ${requestedTier.id}, Status: ${subscription.status}`);
      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_BYPASS_ATTEMPT' as any,
        severity: 'CRITICAL' as any,
        message: `Attempted paid tier access without valid subscription`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'validateAndAssignTier',
        details: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          attemptedTierId: subscription.tierId,
          subscriptionStatus: subscription.status,
          isValidPaid: isValidPaidSubscription,
          isExpired: isExpired
        },
      });
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
   * Check if a user is an admin user (authorized for ultimate tier)
   */
  private async isAdminUser(userId: string): Promise<boolean> {
    try {
      // Check by email since that's the primary admin verification method
      return await this.isAdminByEmail(userId);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Check if a user has admin email (helper for admin verification)
   */
  async isAdminByEmail(userId: string): Promise<boolean> {
    try {
      const user = await databaseStorage.getUser(userId);
      if (!user) return false;
      
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
      return adminEmails.includes(user.email);
    } catch (error) {
      console.error('Error checking admin email:', error);
      return false;
    }
  }

  /**
   * Create ultimate tier subscription for admin users only
   */
  async createAdminUltimateSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      // Verify user is admin
      const isAdmin = await this.isAdminByEmail(userId);
      if (!isAdmin) {
        console.error(`[SECURITY] Non-admin user attempted ultimate subscription creation: ${userId}`);
        securityLogger.logSecurityEvent({
          eventType: 'SECURITY_VIOLATION' as any,
          severity: 'CRITICAL' as any,
          message: `Non-admin user attempted ultimate subscription creation`,
          ip: 'system',
          userAgent: 'subscription-service',
          endpoint: 'createAdminUltimateSubscription',
          details: {
            userId,
            attemptedTier: 'ultimate',
            isAdmin: false,
            securityViolation: true
          },
        });
        return null;
      }

      const now = new Date();
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

      const ultimateSubscription: InsertUserSubscription = {
        userId: userId,
        tierId: 'ultimate',
        status: 'active', // Admin subscriptions are always active
        stripeCustomerId: null, // No Stripe customer for admin
        stripeSubscriptionId: null, // No Stripe subscription for admin
        currentPeriodStart: now,
        currentPeriodEnd: futureDate,
        cancelAtPeriodEnd: false,
      };

      const createdSubscription = await databaseStorage.createUserSubscription(ultimateSubscription);
      
      securityLogger.logSecurityEvent({
        eventType: 'ADMIN_SUBSCRIPTION_CREATED' as any,
        severity: 'MEDIUM' as any,
        message: `Ultimate tier subscription created for admin user`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'createAdminUltimateSubscription',
        details: {
          userId,
          tierId: 'ultimate',
          subscriptionId: createdSubscription.id,
          isAdmin: true,
          adminTier: true
        },
      });

      return createdSubscription;
    } catch (error) {
      console.error('Error creating admin ultimate subscription:', error);
      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_ERROR' as any,
        severity: 'HIGH' as any,
        message: `Error creating admin ultimate subscription`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'createAdminUltimateSubscription',
        details: {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
      });
      return null;
    }
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
   * Get the ultimate tier (admin-only tier)
   */
  private getUltimateTier(): SubscriptionTier {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === 'ultimate') || SUBSCRIPTION_TIERS[SUBSCRIPTION_TIERS.length - 1];
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

        const validatedTier = await this.validateAndAssignTier(subscription);

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

      const validatedTier = await this.validateAndAssignTier(subscription);
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
   * Track document analysis usage with enhanced abuse prevention
   */
  async trackUsage(userId: string, tokensUsed: number, model: string, sessionData?: {
    sessionId: string;
    deviceFingerprint: string;
    ipAddress: string;
  }): Promise<void> {
    try {
      // Route anonymous/session users through collective free tier user with individual tracking
      let trackingUserId = userId;
      
      if (userId === "anonymous" || userId.startsWith('session_') || userId.startsWith('test-session-') || userId.length === 32) {
        trackingUserId = '00000000-0000-0000-0000-000000000001';
        
        // Track usage through collective user service with individual tracking
        if (sessionData) {
          await collectiveUserService.trackDocumentAnalysis(
            sessionData.sessionId,
            sessionData.deviceFingerprint,
            sessionData.ipAddress,
            tokensUsed
          );
          
          // Also track individual usage for monthly limits
          await collectiveUserService.trackIndividualMonthlyUsage(userId, 1);
        }
        
        console.log(`📊 Routing anonymous usage tracking through collective free tier user with individual tracking`);
      } else {
        // Check if authenticated user exists in database
        const userExists = await databaseStorage.userExists(userId);
        if (!userExists) {
          console.log(`📊 User ${userId} not in database, routing through collective free tier for usage tracking`);
          trackingUserId = '00000000-0000-0000-0000-000000000001';
          
          // Also track through collective service for consistency
          if (sessionData) {
            await collectiveUserService.trackDocumentAnalysis(
              sessionData.sessionId,
              sessionData.deviceFingerprint,
              sessionData.ipAddress,
              tokensUsed
            );
            
            // Also track individual usage for monthly limits
            await collectiveUserService.trackIndividualMonthlyUsage(userId, 1);
          }
        }
      }

      // Get user's current subscription to determine tier with validation
      const subscription = await databaseStorage.getUserSubscription(trackingUserId);
      const tier = await this.validateAndAssignTier(subscription);

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

      // Send notification email to user about failed payment
      try {
        const user = await databaseStorage.getUser(userId);
        if (user?.email) {
          const emailSent = await emailService.sendEmail({
            to: user.email,
            subject: '⚠️ Payment Failed - ReadMyFinePrint Subscription',
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Failed - ReadMyFinePrint</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .message { font-size: 16px; line-height: 1.7; margin: 20px 0; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Payment Failed</h1>
            <p>Action needed for your ReadMyFinePrint subscription</p>
        </div>
        
        <div class="content">
            <div class="message">
                <p>Hello,</p>
                <p>We were unable to process your payment for your ReadMyFinePrint subscription.</p>
                
                <p><strong>Payment Details:</strong></p>
                <ul>
                  <li>Amount: ${(invoice.amount_due / 100).toFixed(2)} ${invoice.currency.toUpperCase()}</li>
                  <li>Attempt: ${invoice.attempt_count}</li>
                  <li>Date: ${new Date().toLocaleDateString()}</li>
                </ul>
            </div>
            
            <div class="warning">
                <p><strong>What happens next:</strong></p>
                <ul>
                  <li>We'll automatically retry the payment in a few days</li>
                  <li>Your subscription remains active during this time</li>
                  <li>You can update your payment method to resolve this immediately</li>
                </ul>
            </div>
            
            <div class="cta">
                <a href="https://readmyfineprint.com/subscription" class="button">Update Payment Method</a>
            </div>
            
            <div class="message">
                <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            </div>
        </div>
        
        <div class="footer">
            <p>ReadMyFinePrint - Legal Document Analysis</p>
            <p>This is an automated billing notification.</p>
        </div>
    </div>
</body>
</html>
            `,
            text: `
ReadMyFinePrint - Payment Failed

We were unable to process your payment for your ReadMyFinePrint subscription.

Payment Details:
- Amount: ${(invoice.amount_due / 100).toFixed(2)} ${invoice.currency.toUpperCase()}
- Attempt: ${invoice.attempt_count}
- Date: ${new Date().toLocaleDateString()}

What happens next:
- We'll automatically retry the payment in a few days
- Your subscription remains active during this time
- You can update your payment method to resolve this immediately

Update your payment method: https://readmyfineprint.com/subscription

If you have any questions or need assistance, please contact our support team.

---
ReadMyFinePrint - Legal Document Analysis
This is an automated billing notification.
            `
          });

          if (emailSent) {
            console.log(`📧 Payment failure notification sent to ${user.email}`);
          }
        }
      } catch (emailError) {
        console.error('❌ Failed to send payment failure notification:', emailError);
      }
      
      // Restrict usage if payment fails repeatedly
      await this.handleRepeatedPaymentFailures(userId, invoice.attempt_count);
    } catch (error) {
      console.error('❌ Error handling payment failure:', invoice.id, error);
    }
  }

  /**
   * Handle repeated payment failures by restricting usage
   */
  private async handleRepeatedPaymentFailures(userId: string, attemptCount: number): Promise<void> {
    try {
      // Get user's current subscription
      const subscription = await databaseStorage.getUserSubscription(userId);
      if (!subscription) {
        console.log('No subscription found for user during payment failure handling:', userId);
        return;
      }

      // Implement progressive restrictions based on failure count
      if (attemptCount >= 3) {
        // After 3 failures, downgrade to free tier
        console.log(`⚠️ Downgrading user ${userId} to free tier after ${attemptCount} payment failures`);
        
        await databaseStorage.updateUserSubscription(subscription.id, {
          tierId: 'free',
          status: 'payment_failed'
        });

        // Log the restriction
        securityLogger.logSecurityEvent({
          eventType: 'SUBSCRIPTION_RESTRICTED' as any,
          severity: 'HIGH' as any,
          message: `User subscription restricted due to repeated payment failures`,
          ip: 'system',
          userAgent: 'subscription-service',
          endpoint: 'handleRepeatedPaymentFailures',
          details: {
            userId,
            attemptCount,
            action: 'downgraded_to_free',
            reason: 'repeated_payment_failures'
          },
        });

        // Send restriction notification email
        try {
          const user = await databaseStorage.getUser(userId);
          if (user?.email) {
            await emailService.sendEmail({
              to: user.email,
              subject: '🚨 ReadMyFinePrint - Account Temporarily Restricted',
              html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Restricted - ReadMyFinePrint</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .message { font-size: 16px; line-height: 1.7; margin: 20px 0; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
      </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Account Temporarily Restricted</h1>
            <p>Your ReadMyFinePrint subscription requires attention</p>
        </div>
        
        <div class="content">
            <div class="message">
                <p>Hello,</p>
                <p>Due to repeated payment failures, your ReadMyFinePrint account has been temporarily restricted to free tier access.</p>
            </div>
            
            <div class="warning">
                <p><strong>What this means:</strong></p>
                <ul>
                  <li>Your account is now limited to free tier features</li>
                  <li>You can still use basic document analysis</li>
                  <li>Premium features are temporarily unavailable</li>
                  <li>No data has been lost</li>
                </ul>
            </div>
            
            <div class="message">
                <p><strong>To restore full access:</strong></p>
                <ol>
                  <li>Update your payment method</li>
                  <li>Contact our billing team if you need assistance</li>
                  <li>Your premium features will be restored immediately upon successful payment</li>
                </ol>
            </div>
            
            <div class="cta">
                <a href="https://readmyfineprint.com/subscription" class="button">Update Payment Method</a>
            </div>
            
            <div class="message">
                <p>We understand payment issues happen. If you're experiencing financial difficulties, please contact our support team to discuss options.</p>
            </div>
        </div>
        
        <div class="footer">
            <p>ReadMyFinePrint - Legal Document Analysis</p>
            <p>Contact: admin@readmyfineprint.com</p>
        </div>
    </div>
</body>
</html>
              `,
              text: `
ReadMyFinePrint - Account Temporarily Restricted

Due to repeated payment failures, your ReadMyFinePrint account has been temporarily restricted to free tier access.

What this means:
- Your account is now limited to free tier features
- You can still use basic document analysis
- Premium features are temporarily unavailable
- No data has been lost

To restore full access:
1. Update your payment method
2. Contact our billing team if you need assistance
3. Your premium features will be restored immediately upon successful payment

Update payment method: https://readmyfineprint.com/subscription

We understand payment issues happen. If you're experiencing financial difficulties, please contact our support team to discuss options.

Contact: admin@readmyfineprint.com
              `
            });
            
            console.log(`📧 Account restriction notification sent to ${user.email}`);
          }
        } catch (emailError) {
          console.error('❌ Failed to send restriction notification:', emailError);
        }
      } else if (attemptCount >= 2) {
        // After 2 failures, log warning but maintain access
        console.log(`⚠️ Warning: User ${userId} has ${attemptCount} payment failures`);
        
        securityLogger.logSecurityEvent({
          eventType: 'PAYMENT_WARNING' as any,
          severity: 'MEDIUM' as any,
          message: `User approaching payment failure limit`,
          ip: 'system',
          userAgent: 'subscription-service',
          endpoint: 'handleRepeatedPaymentFailures',
          details: {
            userId,
            attemptCount,
            action: 'warning_logged',
            reason: 'approaching_failure_limit'
          },
        });
      }
    } catch (error) {
      console.error('❌ Error handling repeated payment failures:', error);
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

      // If email is a real customer email (not sanitized), create hashed internal email
      let finalEmail = params.email;
      if (!params.email.includes('@subscription.internalusers.email')) {
        // Import Argon2 hashing functions
        const { createPseudonymizedEmail } = await import('./argon2');
        
        // Create a secure Argon2-hashed internal email to protect customer PII
        finalEmail = await createPseudonymizedEmail(params.email);
        console.log(`Using Argon2-hashed internal email: ${finalEmail} for customer email: ${params.email}`);
      }

      // Create a minimal user record for subscription tracking
      // Email is automatically verified since they completed payment through Stripe
      const user = await databaseStorage.createUser({
        email: finalEmail,
        hashedPassword: crypto.randomBytes(32).toString('hex'), // Random password, can't be used to login
        emailVerified: true, // Payment transaction verifies the email
        lastLoginAt: new Date(), // Set initial login time
      });

      console.log(`Created subscription user ${user.id} for Stripe customer ${params.stripeCustomerId}`);
      return user.id;
    } catch (error) {
      console.error('Error creating subscription user:', error);
      
      // If it's still a duplicate constraint error, try one more time with a salted hash
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
        try {
          // Import Argon2 hashing functions
          const { createPseudonymizedEmail } = await import('./argon2');
          
          // Create a unique salted email by adding timestamp to original email before hashing
          const saltedEmail = `${params.email}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const uniqueEmail = await createPseudonymizedEmail(saltedEmail);
          
          const user = await databaseStorage.createUser({
            email: uniqueEmail,
            hashedPassword: crypto.randomBytes(32).toString('hex'),
            emailVerified: true, // Payment transaction verifies the email
            lastLoginAt: new Date(), // Set initial login time
          });
          
          console.log(`Created subscription user ${user.id} with unique Argon2-hashed email after retry`);
          return user.id;
        } catch (retryError) {
          console.error('Failed to create user even with unique hashed email:', retryError);
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
   * Update subscription tier by user ID (admin method)
   */
  async updateSubscriptionTier(userId: string, newTierId: string, reason?: string): Promise<UserSubscription | null> {
    try {
      const subscription = await databaseStorage.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found to update');
      }

      const newTier = getTierById(newTierId);
      if (!newTier) {
        throw new Error(`Invalid tier ID: ${newTierId}`);
      }

      // Update the subscription tier
      const updatedSubscription = await databaseStorage.updateUserSubscription(subscription.id, {
        tierId: newTierId,
        status: 'active'
      });

      // Log the admin action
      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_TIER_UPDATED' as any,
        severity: 'MEDIUM' as any,
        message: `Admin updated subscription tier for user ${userId} to ${newTierId}`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'admin-tier-update',
        details: {
          userId,
          newTierId,
          reason: reason || 'Admin action',
          subscriptionId: subscription.id
        }
      });

      return updatedSubscription || null;
    } catch (error) {
      console.error('Error updating subscription tier:', error);
      throw error;
    }
  }

  /**
   * Extend subscription period (admin method)
   */
  async extendSubscription(userId: string, days: number = 30, reason?: string): Promise<UserSubscription | null> {
    try {
      const subscription = await databaseStorage.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found to extend');
      }

      // Extend the current period end date
      const newPeriodEnd = new Date(subscription.currentPeriodEnd);
      newPeriodEnd.setDate(newPeriodEnd.getDate() + days);

      const updatedSubscription = await databaseStorage.updateUserSubscription(subscription.id, {
        currentPeriodEnd: newPeriodEnd,
        status: 'active'
      });

      // Log the admin action
      securityLogger.logSecurityEvent({
        eventType: 'SUBSCRIPTION_EXTENDED' as any,
        severity: 'MEDIUM' as any,
        message: `Admin extended subscription for user ${userId} by ${days} days`,
        ip: 'system',
        userAgent: 'subscription-service',
        endpoint: 'admin-extend-subscription',
        details: {
          userId,
          extensionDays: days,
          newPeriodEnd: newPeriodEnd.toISOString(),
          reason: reason || 'Admin action',
          subscriptionId: subscription.id
        }
      });

      return updatedSubscription || null;
    } catch (error) {
      console.error('Error extending subscription:', error);
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
      const tier = await this.validateAndAssignTier(subscription);
      
      // Use hybrid token service (prefers JOSE, falls back to PostgreSQL)
      const token = await secureJWTService.generateSubscriptionToken({
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
      const tokenData = await secureJWTService.validateSubscriptionToken(token);
      if (!tokenData) {
        console.warn('Token not found in storage');
        return null;
      }
      
      // Basic device fingerprint logging (simplified for PostgreSQL storage)
      if (deviceFingerprint && deviceFingerprint !== 'unknown') {
        console.log(`Token used from device: ${deviceFingerprint.slice(0, 16)}... for user ${tokenData.userId}`);
      }
      
      // JOSE tokens are stateless - no usage tracking needed
      // Rate limiting would be handled at the API gateway level or through other means
      
      // Update usage tracking in hybrid service (PostgreSQL tokens only)
      // Token usage tracking not needed for JWT tokens
      
      // Get current subscription data and verify it's still active
      const subscriptionData = await this.getUserSubscriptionWithUsage(tokenData.userId);
      
      // Double-check that the subscription is still active
      if (subscriptionData.subscription && subscriptionData.subscription.status !== 'active') {
        console.warn('Token valid but subscription no longer active');
        // Invalidate the token
        await secureJWTService.revokeToken(token, 'subscription no longer active');
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
   * Uses PostgreSQL for persistent storage
   */
  async storeSessionToken(sessionId: string, token: string, userId?: string): Promise<void> {
    await postgresqlSessionStorage.storeSessionToken(sessionId, token, userId);
    console.log(`Stored session token mapping for session ${sessionId}`);
  }

  /**
   * Get subscription token by checkout session ID
   */
  async getTokenBySession(sessionId: string): Promise<string | null> {
    return await postgresqlSessionStorage.getTokenBySession(sessionId);
  }

  /**
   * Revoke a subscription token (for security incidents)
   */
  async revokeSubscriptionToken(token: string, reason: string): Promise<boolean> {
    try {
      if (!token || token.length < 10) {
        return false;
      }
      
      // Get token data before removal (extract from JOSE token)
      const { joseTokenService } = await import('./jose-token-service');
      const tokenInfo = await joseTokenService.extractTokenInfo(token);
      
      if (!tokenInfo || !tokenInfo.userId) {
        console.warn('Cannot revoke token - unable to extract token info');
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
      
      // Remove from secure JWT service (handles revocation list)
      const success = await secureJWTService.revokeToken(token, reason);
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
      const revokedCount = await secureJWTService.revokeAllUserTokens(userId, reason);
      
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