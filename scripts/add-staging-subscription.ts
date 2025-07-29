#!/usr/bin/env tsx

/**
 * Add Default Subscription to Staging User
 * 
 * Ensures the staging test user has a default free tier subscription
 * so they can login and test subscription management functionality.
 */

import { databaseStorage } from '../server/storage';

async function addStagingSubscription() {
  console.log('🎯 Adding default subscription to staging user...');
  
  const testEmail = 'staging@readmyfineprint.com';

  try {
    // Find the staging user
    console.log(`🔍 Finding user ${testEmail}...`);
    const user = await databaseStorage.getUserByEmail(testEmail);
    
    if (!user) {
      console.error(`❌ User ${testEmail} not found!`);
      console.log('Run "npm run staging:create-user" first to create the user.');
      return;
    }

    console.log(`✅ Found user: ${user.id}`);

    // Create default subscription using subscription service
    console.log('🎯 Creating default free tier subscription...');
    const { subscriptionService } = await import('../server/subscription-service');
    
    // This will create a free tier subscription if one doesn't exist
    await subscriptionService.ensureUserHasSubscription(user.id);
    
    // Get the user's subscription details to verify
    const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(user.id);
    
    console.log('\n🎉 Subscription setup completed!');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Subscription Tier: ${subscriptionData.subscription?.tierId || 'free'}`);
    console.log(`   Status: ${subscriptionData.subscription?.status || 'inactive'}`);
    console.log(`   Documents Remaining: ${subscriptionData.documentsRemaining}`);
    
    console.log('\n📋 User can now:');
    console.log('✅ Login to staging environment');
    console.log('✅ Access subscription management');
    console.log('✅ Test subscription upgrades');
    console.log('✅ Test document analysis (free tier limits)');

  } catch (error) {
    console.error('❌ Failed to add subscription:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    
    throw error;
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  addStagingSubscription()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { addStagingSubscription };