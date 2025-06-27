#!/usr/bin/env node

import { subscriptionService } from '../server/subscription-service';
import { databaseStorage } from '../server/storage';

async function createAdminUltimateSubscription() {
  try {
    console.log('🔍 Looking for admin users...');
    
    // Get all users and find admin users by email
    const users = await databaseStorage.getAllUsers();
    const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
    
    const adminUsers = users.filter(user => adminEmails.includes(user.email));
    
    if (adminUsers.length === 0) {
      console.log('❌ No admin users found with emails:', adminEmails.join(', '));
      return;
    }
    
    for (const adminUser of adminUsers) {
      console.log(`\n👤 Processing admin user: ${adminUser.email} (${adminUser.id})`);
      
      // Check if they already have an ultimate subscription
      const existingSubscription = await databaseStorage.getUserSubscription(adminUser.id);
      
      if (existingSubscription && existingSubscription.tierId === 'ultimate') {
        console.log(`✅ ${adminUser.email} already has ultimate tier subscription`);
        continue;
      }
      
      // Delete existing subscription if it's not ultimate tier
      if (existingSubscription) {
        console.log(`🗑️ Removing existing ${existingSubscription.tierId} tier subscription...`);
        await databaseStorage.deleteUserSubscription(adminUser.id);
      }
      
      // Create ultimate tier subscription
      console.log(`⭐ Creating ultimate tier subscription for ${adminUser.email}...`);
      const ultimateSubscription = await subscriptionService.createAdminUltimateSubscription(adminUser.id);
      
      if (ultimateSubscription) {
        console.log(`✅ Ultimate tier subscription created successfully!`);
        console.log(`   - Subscription ID: ${ultimateSubscription.id}`);
        console.log(`   - Tier: ${ultimateSubscription.tierId}`);
        console.log(`   - Status: ${ultimateSubscription.status}`);
        console.log(`   - Expires: ${ultimateSubscription.currentPeriodEnd}`);
      } else {
        console.log(`❌ Failed to create ultimate tier subscription`);
      }
    }
    
    console.log('\n✅ Admin ultimate tier setup complete!');
  } catch (error) {
    console.error('❌ Error creating admin ultimate subscription:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUltimateSubscription(); 