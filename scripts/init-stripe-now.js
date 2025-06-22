
#!/usr/bin/env node

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
