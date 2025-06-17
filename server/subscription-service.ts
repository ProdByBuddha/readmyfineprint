import Stripe from 'stripe';
import type { UserSubscription, SubscriptionTier, Usage } from '@shared/schema';
import { SUBSCRIPTION_TIERS, getTierById } from './subscription-tiers';
import { securityLogger } from './security-logger';

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
              priceId: monthlyPriceId,
            },
          });
        }

        // Create yearly price
        const yearlyPriceId = `${productId}_yearly`;
        try {
          await stripe.prices.retrieve(yearlyPriceId);
        } catch (error) {
          await stripe.prices.create({
            product: product.id,
            unit_amount: tier.yearlyPrice * 100, // Convert to cents
            currency: 'usd',
            recurring: {
              interval: 'year',
            },
            metadata: {
              tierId: tier.id,
              billingCycle: 'yearly',
              priceId: yearlyPriceId,
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
    // In a real implementation, this would query your database
    // For now, we'll simulate with a free tier user
    const tier = SUBSCRIPTION_TIERS[0]; // Free tier
    const usage: SubscriptionUsage = {
      documentsAnalyzed: 1,
      tokensUsed: 3500,
      cost: 0.00425,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };

    const canUpgrade = usage.documentsAnalyzed >= tier.limits.documentsPerMonth * 0.8;
    const suggestedUpgrade = canUpgrade ? SUBSCRIPTION_TIERS[1] : undefined; // Starter tier

    return {
      tier,
      usage,
      canUpgrade,
      suggestedUpgrade,
    };
  }

  /**
   * Track document analysis usage
   */
  async trackUsage(userId: string, tokensUsed: number, model: string): Promise<void> {
    const tier = getTierById('free'); // This would be looked up from user's subscription
    if (!tier) return;

    const cost = this.calculateTokenCost(tokensUsed, tier);

    // In a real implementation, this would update usage in your database
    console.log(`Usage tracked for user ${userId}:`, {
      tokensUsed,
      model,
      cost,
    });
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
    // Update user subscription in database
    console.log('Subscription updated:', subscription.id);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Mark subscription as canceled in database
    // Downgrade user to free tier
    console.log('Subscription deleted:', subscription.id);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Reset usage for the new billing period
    console.log('Payment succeeded for invoice:', invoice.id);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Handle failed payment - send notification, restrict usage, etc.
    console.log('Payment failed for invoice:', invoice.id);
  }
}

export const subscriptionService = new SubscriptionService();
