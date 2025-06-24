#!/usr/bin/env tsx

/**
 * Test Stripe customer ID synchronization functionality
 */

import { databaseStorage } from '../server/storage';
import crypto from 'crypto';

async function testStripeSync() {
  console.log('🧪 Testing Stripe customer ID synchronization...\n');
  
  try {
    // Create a test user
    const testEmail = `test-stripe-sync-${Date.now()}@example.com`;
    const testUser = await databaseStorage.createUser({
      email: testEmail,
      username: `testuser-${Date.now()}`,
      hashedPassword: 'test-password-hash'
    });
    
    console.log(`✅ Created test user: ${testUser.email} (ID: ${testUser.id})`);
    console.log(`   Initial Stripe customer ID: ${testUser.stripeCustomerId || 'null'}`);
    
    // Create a subscription with a Stripe customer ID
    const testStripeCustomerId = `cus_test_${crypto.randomBytes(8).toString('hex')}`;
    const subscription = await databaseStorage.createUserSubscription({
      userId: testUser.id,
      tierId: 'starter',
      status: 'active',
      stripeCustomerId: testStripeCustomerId,
      stripeSubscriptionId: `sub_test_${crypto.randomBytes(8).toString('hex')}`,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false
    });
    
    console.log(`\n✅ Created test subscription: ${subscription.id}`);
    console.log(`   Stripe customer ID: ${subscription.stripeCustomerId}`);
    
    // Check if the user's Stripe customer ID was synced
    const updatedUser = await databaseStorage.getUser(testUser.id);
    
    console.log(`\n🔍 Checking user after subscription creation:`);
    console.log(`   User Stripe customer ID: ${updatedUser?.stripeCustomerId || 'null'}`);
    console.log(`   Subscription Stripe customer ID: ${subscription.stripeCustomerId}`);
    
    if (updatedUser?.stripeCustomerId === subscription.stripeCustomerId) {
      console.log(`\n✅ SUCCESS: Stripe customer ID synced correctly!`);
    } else {
      console.log(`\n❌ FAILED: Stripe customer ID not synced!`);
      console.log(`   Expected: ${subscription.stripeCustomerId}`);
      console.log(`   Got: ${updatedUser?.stripeCustomerId || 'null'}`);
    }
    
    // Test updating subscription with different Stripe customer ID
    console.log(`\n🧪 Testing subscription update sync...`);
    const newStripeCustomerId = `cus_updated_${crypto.randomBytes(8).toString('hex')}`;
    
    const updatedSubscription = await databaseStorage.updateUserSubscription(subscription.id, {
      stripeCustomerId: newStripeCustomerId
    });
    
    const finalUser = await databaseStorage.getUser(testUser.id);
    
    console.log(`   Updated subscription Stripe customer ID: ${updatedSubscription?.stripeCustomerId}`);
    console.log(`   Updated user Stripe customer ID: ${finalUser?.stripeCustomerId || 'null'}`);
    
    if (finalUser?.stripeCustomerId === newStripeCustomerId) {
      console.log(`\n✅ SUCCESS: Subscription update sync works correctly!`);
    } else {
      console.log(`\n❌ FAILED: Subscription update sync failed!`);
      console.log(`   Expected: ${newStripeCustomerId}`);
      console.log(`   Got: ${finalUser?.stripeCustomerId || 'null'}`);
    }
    
    // Clean up test data
    console.log(`\n🧹 Cleaning up test data...`);
    // Note: In a real scenario, you might want to clean up the test data
    // For this test, we'll leave it to avoid complex cleanup logic
    
    console.log('\n🎉 Stripe customer ID synchronization test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testStripeSync().then(() => process.exit(0)).catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testStripeSync };