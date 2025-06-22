
<old_str>
import { subscriptionService } from '../server/subscription-service.js';

async function initStripeProducts() {
  console.log('🚀 Initializing Stripe products...');
  
  try {
    await subscriptionService.initializeStripeProducts();
    console.log('✅ Stripe products initialized successfully!');
    console.log('🔄 Server restart recommended to ensure all services are in sync.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize Stripe products:', error.message);
    process.exit(1);
  }
}

initStripeProducts();
</old_str>
<new_str>
// Simple script to initialize Stripe products
// Run with: npx tsx scripts/init-stripe-now.js

import { subscriptionService } from '../server/subscription-service.js';

async function initStripeProducts() {
  console.log('🚀 Initializing Stripe products...');
  
  try {
    await subscriptionService.initializeStripeProducts();
    console.log('✅ Stripe products initialized successfully!');
    console.log('🔄 Server restart recommended to ensure all services are in sync.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize Stripe products:', error.message);
    process.exit(1);
  }
}

initStripeProducts();
</new_str>
