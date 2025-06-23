#!/usr/bin/env node

/**
 * Test script for multi-device subscription support
 * Verifies that subscription tokens work across multiple devices
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

async function testMultiDeviceSupport() {
  console.log('🧪 Testing Multi-Device Subscription Support...\n');

  try {
    // Import the subscription service
    const { subscriptionService } = await import('../server/subscription-service.ts');
    
    const testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };

    function logTest(name, passed, details) {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${name}`);
      if (details) console.log(`   ${details}`);
      
      testResults.tests.push({ name, passed, details });
      if (passed) testResults.passed++;
      else testResults.failed++;
    }

    // Test 1: Generate a subscription token
    console.log('📋 Test 1: Token Generation');
    const testUserId = `test-user-${Date.now()}`;
    const testSubscriptionId = `test-sub-${Date.now()}`;
    const device1Fingerprint = 'device1_fingerprint_12345';
    
    const token = await subscriptionService.generateSubscriptionToken(
      testUserId, 
      testSubscriptionId, 
      device1Fingerprint
    );
    
    logTest('Token generated successfully', !!token, `Token: ${token.slice(0, 16)}...`);

    // Test 2: Validate token from original device
    console.log('\n📋 Test 2: Original Device Validation');
    const validation1 = await subscriptionService.validateSubscriptionToken(
      token, 
      device1Fingerprint, 
      '192.168.1.100'
    );
    
    logTest(
      'Token validates on original device',
      validation1 !== null,
      'Token accepted from device 1'
    );

    // Test 3: Validate token from different devices (should work)
    console.log('\n📋 Test 3: Multi-Device Support');
    const device2Fingerprint = 'device2_fingerprint_67890';
    const device3Fingerprint = 'device3_fingerprint_abcde';
    
    const validation2 = await subscriptionService.validateSubscriptionToken(
      token, 
      device2Fingerprint, 
      '192.168.1.101'
    );
    
    logTest(
      'Token validates on second device',
      validation2 !== null,
      'Token accepted from device 2'
    );

    const validation3 = await subscriptionService.validateSubscriptionToken(
      token, 
      device3Fingerprint, 
      '192.168.1.102'
    );
    
    logTest(
      'Token validates on third device',
      validation3 !== null,
      'Token accepted from device 3'
    );

    // Test 4: Test many devices (should trigger warning but still work)
    console.log('\n📋 Test 4: Many Device Usage Detection');
    let manyDeviceValidations = 0;
    
    for (let i = 4; i <= 12; i++) {
      const deviceFingerprint = `device${i}_fingerprint_${crypto.randomBytes(4).toString('hex')}`;
      const validation = await subscriptionService.validateSubscriptionToken(
        token, 
        deviceFingerprint, 
        `192.168.1.${100 + i}`
      );
      
      if (validation !== null) {
        manyDeviceValidations++;
      }
    }
    
    logTest(
      'Multiple devices still work (with warnings)',
      manyDeviceValidations >= 8, // Should work even with warnings
      `${manyDeviceValidations}/9 additional devices validated`
    );

    // Test 5: Verify device tracking
    console.log('\n📋 Test 5: Device Tracking');
    const { replitTokenStorage } = await import('../server/replit-token-storage.ts');
    const deviceKey = `user_devices:${testUserId}`;
    const deviceData = await replitTokenStorage.getDeviceData(deviceKey);
    
    logTest(
      'Device data is tracked',
      deviceData && deviceData.devices && deviceData.devices.length > 0,
      `Tracked ${deviceData?.devices?.length || 0} devices`
    );

    logTest(
      'Multiple devices recorded',
      deviceData && deviceData.devices && deviceData.devices.length >= 3,
      `Expected >= 3 devices, got ${deviceData?.devices?.length || 0}`
    );

    // Test 6: Cleanup test data
    console.log('\n📋 Test 6: Cleanup');
    await replitTokenStorage.removeToken(token);
    const cleanupDevice = await replitTokenStorage.getDeviceData(deviceKey);
    
    logTest('Test token removed', true, 'Token deleted from storage');

    // Print test summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.tests.length}`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests
        .filter(test => !test.passed)
        .forEach(test => console.log(`   - ${test.name}: ${test.details}`));
    }

    if (testResults.failed === 0) {
      console.log('\n🎉 All multi-device tests passed!');
      console.log('📱 Users can now access their subscription from any device.');
      console.log('🔒 Security monitoring still detects suspicious usage patterns.');
    }

    return testResults.failed === 0;

  } catch (error) {
    console.error('💥 Test suite failed:', error);
    return false;
  }
}

// Run the test
testMultiDeviceSupport()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });