#!/usr/bin/env tsx
/**
 * Generate a JOSE subscription token for admin user using known admin user ID
 */

import { joseTokenService } from '../server/jose-token-service';

async function createJoseAdminToken() {
  try {
    console.log('🔧 Creating JOSE admin token...');
    
    // Use the admin user ID we created earlier (from the database output)
    const adminUserId = 'd1417da4-487f-435e-b881-274f29b21609'; // admin@readmyfineprint.com
    
    console.log(`👤 Creating token for admin user: ${adminUserId}`);
    
    // Generate JOSE subscription token
    const token = await joseTokenService.generateSubscriptionToken({
      userId: adminUserId,
      tierId: 'ultimate',
      deviceFingerprint: 'admin-local-test-device'
    });
    
    console.log(`\n🎫 ADMIN JOSE TOKEN:`);
    console.log(`${token}`);
    
    // Test the token
    const validation = await joseTokenService.validateSubscriptionToken(token);
    if (validation) {
      console.log(`\n✅ Token validation successful`);
      console.log(`   User ID: ${validation.userId}`);
      console.log(`   Tier: ${validation.tierId}`);
      console.log(`   Expires: ${validation.expiresAt}`);
    } else {
      console.log(`\n❌ Token validation failed`);
    }
    
    console.log(`\n💡 Test admin endpoint with:`);
    console.log(`curl -H "x-subscription-token: ${token}" http://localhost:5000/api/admin/metrics-subscription`);
    
  } catch (error) {
    console.error('❌ Error creating JOSE admin token:', error);
  }
}

// Run the script
createJoseAdminToken().then(() => {
  console.log('\n✅ JOSE admin token creation completed');
}).catch(error => {
  console.error('❌ Failed to create JOSE admin token:', error);
  process.exit(1);
});