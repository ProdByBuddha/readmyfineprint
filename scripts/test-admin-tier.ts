#!/usr/bin/env node

import { subscriptionService } from '../server/subscription-service';
import { databaseStorage } from '../server/storage';

async function testAdminTier() {
  try {
    console.log('🔍 Testing admin tier assignment...');
    
    // Get all users and find admin users by email
    const users = await databaseStorage.getAllUsers();
    const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
    
    for (const adminEmail of adminEmails) {
      const adminUser = users.find(user => user.email === adminEmail);
      
      if (!adminUser) {
        console.log(`❌ Admin user not found: ${adminEmail}`);
        continue;
      }
      
      console.log(`\n👤 Testing admin user: ${adminUser.email} (${adminUser.id})`);
      
      // Get their current subscription data
      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(adminUser.id);
      
      console.log(`📊 Current tier: ${subscriptionData.tier.name} (${subscriptionData.tier.id})`);
      console.log(`💳 Has subscription: ${!!subscriptionData.subscription}`);
      
      if (subscriptionData.subscription) {
        console.log(`   - Subscription ID: ${subscriptionData.subscription.id}`);
        console.log(`   - Status: ${subscriptionData.subscription.status}`);
        console.log(`   - Tier ID: ${subscriptionData.subscription.tierId}`);
        console.log(`   - Expires: ${subscriptionData.subscription.currentPeriodEnd}`);
      }
      
      // Check if admin verification is working
      const isAdmin = await subscriptionService.isAdminByEmail(adminUser.id);
      console.log(`🔐 Verified as admin: ${isAdmin}`);
      
      if (subscriptionData.tier.id !== 'ultimate') {
        console.log(`⚠️  ISSUE: Admin user does not have ultimate tier!`);
      } else {
        console.log(`✅ Admin user correctly has ultimate tier`);
      }
    }
    
    console.log('\n✅ Admin tier test complete!');
  } catch (error) {
    console.error('❌ Error testing admin tier:', error);
    process.exit(1);
  }
}

testAdminTier(); 