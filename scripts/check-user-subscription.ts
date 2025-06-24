#!/usr/bin/env tsx

/**
 * Check user subscription status
 * Helps diagnose why subscription shows as "free" instead of "starter"
 */

import { databaseStorage } from '../server/storage';
import { subscriptionService } from '../server/subscription-service';

async function checkUserSubscription() {
  console.log('🔍 Checking user subscription status...\n');
  
  try {
    // Check for user with email beatsbybuddha@gmail.com
    const email = 'beatsbybuddha@gmail.com';
    const user = await databaseStorage.getUserByEmail(email);
    
    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      return;
    }
    
    console.log(`✅ Found user: ${user.id}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`👤 Username: ${user.username || 'none'}`);
    console.log(`🆔 Stripe Customer ID: ${user.stripeCustomerId || 'none'}\n`);
    
    // Get user's subscription record
    const subscription = await databaseStorage.getUserSubscription(user.id);
    
    if (!subscription) {
      console.log(`❌ No subscription found for user ${user.id}`);
      return;
    }
    
    console.log('📋 Raw Subscription Data:');
    console.log(`  ID: ${subscription.id}`);
    console.log(`  User ID: ${subscription.userId}`);
    console.log(`  Tier ID: ${subscription.tierId}`);
    console.log(`  Status: ${subscription.status}`);
    console.log(`  Stripe Customer ID: ${subscription.stripeCustomerId || 'none'}`);
    console.log(`  Stripe Subscription ID: ${subscription.stripeSubscriptionId || 'none'}`);
    console.log(`  Current Period Start: ${subscription.currentPeriodStart}`);
    console.log(`  Current Period End: ${subscription.currentPeriodEnd}`);
    console.log(`  Cancel At Period End: ${subscription.cancelAtPeriodEnd}`);
    console.log(`  Created At: ${subscription.createdAt}`);
    console.log(`  Updated At: ${subscription.updatedAt}\n`);
    
    // Check if subscription is expired
    const now = new Date();
    const isExpired = subscription.currentPeriodEnd < now;
    console.log(`⏰ Is Expired: ${isExpired}`);
    if (isExpired) {
      console.log(`  ⚠️  Subscription expired: ${subscription.currentPeriodEnd} < ${now}`);
    }
    
    // Check subscription status validity
    const validPaidStatuses = ['active', 'trialing'];
    const isValidPaid = validPaidStatuses.includes(subscription.status);
    console.log(`💳 Is Valid Paid Status: ${isValidPaid} (${subscription.status})`);
    
    // Get subscription with usage info from service
    console.log('\n🔄 Getting subscription through service...');
    const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(user.id);
    
    console.log('📊 Service Response:');
    console.log(`  Tier: ${subscriptionData.tier.name} (${subscriptionData.tier.id})`);
    console.log(`  Can Upgrade: ${subscriptionData.canUpgrade}`);
    console.log(`  Documents Analyzed: ${subscriptionData.usage.documentsAnalyzed}`);
    console.log(`  Tokens Used: ${subscriptionData.usage.tokensUsed}`);
    console.log(`  Cost: $${subscriptionData.usage.cost}`);
    console.log(`  Reset Date: ${subscriptionData.usage.resetDate}`);
    
    if (subscriptionData.subscription) {
      console.log(`  Service Subscription Status: ${subscriptionData.subscription.status}`);
      console.log(`  Service Subscription Tier: ${subscriptionData.subscription.tierId}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking subscription:', error);
  }
}

// Run the check if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkUserSubscription().then(() => process.exit(0)).catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });
}

export { checkUserSubscription };