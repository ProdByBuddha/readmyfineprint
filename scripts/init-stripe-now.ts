
// Simple script to initialize Stripe products
// Run with: npx tsx scripts/init-stripe-now.ts

import { subscriptionService } from '../server/subscription-service.js';

async function initStripeProducts(): Promise<void> {
  console.log('🚀 Initializing Stripe products...');
  
  try {
    await subscriptionService.initializeStripeProducts();
    console.log('✅ Stripe products initialized successfully!');
    console.log('🔄 Server restart recommended to ensure all services are in sync.');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to initialize Stripe products:', errorMessage);
    process.exit(1);
  }
}

initStripeProducts();
