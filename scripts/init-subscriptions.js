#!/usr/bin/env node

/**
 * Initialize Stripe Products for Subscription System
 *
 * This script creates the necessary Stripe products and prices
 * for the tiered subscription system. Run this once after deployment.
 *
 * Usage: node scripts/init-subscriptions.js [--production]
 */

const { subscriptionService } = require('../server/subscription-service.ts');

async function initializeSubscriptions() {
  console.log('🚀 Initializing Stripe products for subscription system...');

  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('❌ STRIPE_SECRET_KEY environment variable is not set');
    }

    console.log('✅ Stripe secret key found');

    // Initialize all products and prices
    await subscriptionService.initializeStripeProducts();

    console.log('🎉 Subscription system initialized successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Configure webhook endpoints in Stripe dashboard');
    console.log('2. Add STRIPE_WEBHOOK_SECRET to your environment variables');
    console.log('3. Test the subscription flow on /subscription');
    console.log('');
    console.log('Available tiers:');
    console.log('- Free: GPT-3.5-Turbo (3 docs/month)');
    console.log('- Starter: GPT-4o-mini ($15/month, 50 docs)');
    console.log('- Professional: GPT-4o ($75/month, 200 docs)');
    console.log('- Business: GPT-4-Turbo ($250/month, 500 docs)');
    console.log('- Enterprise: o1-preview ($500/month, 1000+ docs)');

  } catch (error) {
    console.error('❌ Failed to initialize subscription system:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Verify STRIPE_SECRET_KEY is set correctly');
    console.error('2. Ensure Stripe account is activated');
    console.error('3. Check network connectivity to Stripe API');
    process.exit(1);
  }
}

// Check for production flag
const isProduction = process.argv.includes('--production');
if (isProduction) {
  console.log('⚠️  Running in PRODUCTION mode');
} else {
  console.log('🧪 Running in DEVELOPMENT mode');
}

// Run the initialization
initializeSubscriptions();
