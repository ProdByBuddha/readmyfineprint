
import { databaseStorage } from '../server/storage';
import { subscriptionService } from '../server/subscription-service';

async function testTierAssignment() {
  console.log('🔍 Testing Subscription Tier Assignment System...\n');

  try {
    // Test 1: Admin user tier assignment
    console.log('📋 Test 1: Admin User Tier Assignment');
    const adminUserId = 'c970c8a1-3a9d-43e0-b758-e5092db524ff';
    
    const adminResult = await subscriptionService.getUserSubscriptionWithUsage(adminUserId);
    console.log(`   Admin tier: ${adminResult.tier.id} (expected: ultimate)`);
    console.log(`   ✅ Admin test: ${adminResult.tier.id === 'ultimate' ? 'PASS' : 'FAIL'}\n`);

    // Test 2: Anonymous user tier assignment
    console.log('📋 Test 2: Anonymous User Tier Assignment');
    const anonUserId = 'session_test_' + Date.now();
    
    const anonResult = await subscriptionService.getUserSubscriptionWithUsage(anonUserId);
    console.log(`   Anonymous tier: ${anonResult.tier.id} (expected: free)`);
    console.log(`   ✅ Anonymous test: ${anonResult.tier.id === 'free' ? 'PASS' : 'FAIL'}\n`);

    // Test 3: Regular user with no subscription
    console.log('📋 Test 3: Regular User (No Subscription)');
    const regularUserId = '12345678-1234-1234-1234-123456789012';
    
    const regularResult = await subscriptionService.getUserSubscriptionWithUsage(regularUserId);
    console.log(`   Regular user tier: ${regularResult.tier.id} (expected: free)`);
    console.log(`   ✅ Regular user test: ${regularResult.tier.id === 'free' ? 'PASS' : 'FAIL'}\n`);

    // Test 4: Validate tier assignment logic directly
    console.log('📋 Test 4: Direct Admin Detection');
    const isAdmin1 = await subscriptionService.isAdminByEmail('c970c8a1-3a9d-43e0-b758-e5092db524ff');
    const isAdmin2 = await subscriptionService.isAdminByEmail('24c3ec47-dd61-4619-9c9e-18abbd0981ea');
    const isNotAdmin = await subscriptionService.isAdminByEmail(regularUserId);
    
    console.log(`   Admin user 1 detection: ${isAdmin1} (expected: true)`);
    console.log(`   Admin user 2 detection: ${isAdmin2} (expected: true)`);
    console.log(`   Regular user detection: ${isNotAdmin} (expected: false)`);
    console.log(`   ✅ Admin detection test: ${isAdmin1 && isAdmin2 && !isNotAdmin ? 'PASS' : 'FAIL'}\n`);

    // Test 5: Subscription validation
    console.log('📋 Test 5: Admin Subscription Validation');
    const adminSubscription = await databaseStorage.getUserSubscription(adminUserId);
    if (adminSubscription) {
      console.log(`   Admin subscription found: ID ${adminSubscription.id}`);
      console.log(`   Admin subscription tier: ${adminSubscription.tierId} (expected: ultimate)`);
      console.log(`   Admin subscription status: ${adminSubscription.status} (expected: active)`);
      console.log(`   ✅ Admin subscription test: ${adminSubscription.tierId === 'ultimate' && adminSubscription.status === 'active' ? 'PASS' : 'FAIL'}\n`);
    } else {
      console.log(`   ❌ No subscription found for admin user - this may be an issue`);
      console.log(`   ✅ Admin subscription test: FAIL\n`);
    }

    console.log('🎯 Summary of Tier Assignment Tests:');
    console.log('   - Admin users should get ultimate tier automatically');
    console.log('   - Anonymous/session users should get free tier');
    console.log('   - Regular users without subscriptions should get free tier');
    console.log('   - Admin detection should work reliably');
    console.log('   - Admin users should have ultimate tier subscriptions');
    
  } catch (error) {
    console.error('❌ Error during tier assignment testing:', error);
  }
}

if (require.main === module) {
  testTierAssignment()
    .then(() => {
      console.log('✅ Tier assignment testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Tier assignment testing failed:', error);
      process.exit(1);
    });
}

export { testTierAssignment };
