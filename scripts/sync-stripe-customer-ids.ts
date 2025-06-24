#!/usr/bin/env tsx

/**
 * Sync Stripe customer IDs from user_subscriptions to users table
 * Fixes any existing data where the users table is missing Stripe customer IDs
 */

import { databaseStorage } from '../server/storage';

async function syncStripeCustomerIds() {
  console.log('🔄 Syncing Stripe customer IDs from subscriptions to users...\n');
  
  try {
    // Get all subscriptions with Stripe customer IDs
    const allSubscriptions = await databaseStorage.getAllUserSubscriptions();
    const subscriptionsWithStripe = allSubscriptions.filter(sub => sub.stripeCustomerId);
    
    console.log(`📋 Found ${subscriptionsWithStripe.length} subscriptions with Stripe customer IDs`);
    
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const subscription of subscriptionsWithStripe) {
      try {
        // Get the user
        const user = await databaseStorage.getUser(subscription.userId);
        
        if (!user) {
          console.warn(`⚠️  User ${subscription.userId} not found for subscription ${subscription.id}`);
          errorCount++;
          continue;
        }
        
        // Check if user already has this Stripe customer ID
        if (user.stripeCustomerId === subscription.stripeCustomerId) {
          console.log(`✅ User ${user.email} already has correct Stripe customer ID: ${subscription.stripeCustomerId}`);
          skippedCount++;
          continue;
        }
        
        // Sync the Stripe customer ID
        console.log(`🔄 Syncing Stripe customer ID for user ${user.email}:`);
        console.log(`   From: ${user.stripeCustomerId || 'null'}`);
        console.log(`   To: ${subscription.stripeCustomerId}`);
        
        await databaseStorage.updateUser(user.id, {
          stripeCustomerId: subscription.stripeCustomerId
        });
        
        console.log(`✅ Updated user ${user.email} with Stripe customer ID: ${subscription.stripeCustomerId}\n`);
        syncedCount++;
        
      } catch (error) {
        console.error(`❌ Error syncing subscription ${subscription.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📊 Sync Summary:');
    console.log(`   ✅ Synced: ${syncedCount} users`);
    console.log(`   ⏭️  Skipped (already correct): ${skippedCount} users`);
    console.log(`   ❌ Errors: ${errorCount} users`);
    console.log(`   📋 Total processed: ${subscriptionsWithStripe.length} subscriptions`);
    
    if (syncedCount > 0) {
      console.log('\n🎉 Stripe customer ID sync completed successfully!');
    } else {
      console.log('\n✨ All Stripe customer IDs were already in sync!');
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run the sync if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncStripeCustomerIds().then(() => process.exit(0)).catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
}

export { syncStripeCustomerIds };