#!/usr/bin/env tsx

/**
 * Migration script to update free tier users' subscription status to 'inactive'
 * This script will:
 * 1. Find all users with free tier subscriptions
 * 2. Update their status from any current status to 'inactive'
 * 3. Create inactive subscriptions for free tier users who don't have any subscription record
 */

import { db } from '../server/db';
import { userSubscriptions, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { subscriptionService } from '../server/subscription-service';

async function migrateFreeUserSubscriptions() {
  console.log('🔄 Starting free tier subscription status migration...');

  try {
    // Step 1: Update existing free tier subscriptions to 'inactive' status
    console.log('📋 Step 1: Updating existing free tier subscriptions...');
    
    const updateResult = await db
      .update(userSubscriptions)
      .set({ 
        status: 'inactive',
        updatedAt: new Date()
      })
      .where(eq(userSubscriptions.tierId, 'free'))
      .returning({ id: userSubscriptions.id, userId: userSubscriptions.userId });

    console.log(`✅ Updated ${updateResult.length} existing free tier subscriptions to 'inactive' status`);

    // Step 2: Find users without any subscription and create inactive free tier subscriptions
    console.log('📋 Step 2: Finding users without subscriptions...');
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`👥 Found ${allUsers.length} total users`);

    // Check each user for subscription status
    let createdCount = 0;
    for (const user of allUsers) {
      const existingSubscription = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, user.id))
        .limit(1);

      if (existingSubscription.length === 0) {
        // User has no subscription, create inactive free tier subscription
        try {
          await subscriptionService.createInactiveFreeSubscription(user.id);
          createdCount++;
          console.log(`✅ Created inactive free subscription for user: ${user.id}`);
        } catch (error) {
          console.error(`❌ Failed to create subscription for user ${user.id}:`, error);
        }
      }
    }

    console.log(`✅ Created ${createdCount} new inactive free tier subscriptions`);

    // Step 3: Ensure collective free tier user exists with inactive subscription
    console.log('📋 Step 3: Ensuring collective free tier user exists...');
    await subscriptionService.ensureCollectiveFreeUserExists();

    // Step 4: Summary report
    console.log('📊 Migration Summary:');
    
    const totalFreeSubscriptions = await db
      .select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.tierId, 'free'),
        eq(userSubscriptions.status, 'inactive')
      ));

    console.log(`📈 Total inactive free tier subscriptions: ${totalFreeSubscriptions.length}`);
    console.log(`📈 Updated existing subscriptions: ${updateResult.length}`);
    console.log(`📈 Created new subscriptions: ${createdCount}`);
    
    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  migrateFreeUserSubscriptions()
    .then(() => {
      console.log('✅ Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateFreeUserSubscriptions };