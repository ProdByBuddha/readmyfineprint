#!/usr/bin/env tsx
/**
 * Generate a subscription token for admin user testing
 */

import { hybridTokenService } from '../server/hybrid-token-service';
import { databaseStorage } from '../server/storage';

async function createAdminToken() {
  try {
    console.log('🔧 Creating admin subscription token...');
    
    // Get the admin user we created
    const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
    
    for (const email of adminEmails) {
      try {
        console.log(`\n👤 Processing admin: ${email}`);
        
        // Get user from database
        const users = await databaseStorage.getAllUsers();
        const adminUser = users.find(u => u.email === email);
        
        if (!adminUser) {
          console.log(`❌ Admin user not found: ${email}`);
          continue;
        }
        
        console.log(`✅ Found admin user: ${adminUser.id}`);
        
        // Get their subscription
        const subscription = await databaseStorage.getUserSubscription(adminUser.id);
        
        if (!subscription) {
          console.log(`❌ No subscription found for ${email}`);
          continue;
        }
        
        console.log(`✅ Found subscription: ${subscription.tierId} (${subscription.status})`);
        
        // Generate subscription token
        const token = await hybridTokenService.generateSubscriptionToken({
          userId: adminUser.id,
          subscriptionId: subscription.id,
          tierId: subscription.tierId,
          deviceFingerprint: 'admin-local-test-device'
        });
        
        console.log(`\n🎫 ADMIN SUBSCRIPTION TOKEN for ${email}:`);
        console.log(`${token}`);
        
        // Test the token
        const validation = await hybridTokenService.validateSubscriptionToken(token);
        if (validation) {
          console.log(`✅ Token validation successful`);
          console.log(`   User ID: ${validation.userId}`);
          console.log(`   Tier: ${validation.tierId}`);
          console.log(`   Expires: ${validation.expiresAt}`);
        } else {
          console.log(`❌ Token validation failed`);
        }
        
        console.log(`\n💡 Test admin endpoint with:`);
        console.log(`curl -H "x-subscription-token: ${token}" http://localhost:5000/api/admin/metrics-subscription`);
        
        // Only create token for first admin found
        break;
        
      } catch (error) {
        console.error(`❌ Error processing ${email}:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error creating admin token:', error);
  }
}

// Run the script
createAdminToken().then(() => {
  console.log('\n✅ Admin token creation completed');
}).catch(error => {
  console.error('❌ Failed to create admin token:', error);
  process.exit(1);
});