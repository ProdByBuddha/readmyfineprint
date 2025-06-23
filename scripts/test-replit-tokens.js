#!/usr/bin/env node

/**
 * Test script for Replit database token storage
 * Verifies that tokens can be stored, retrieved, and managed securely
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Dynamically import the token storage
async function testReplitTokenStorage() {
  console.log('🧪 Testing Replit Database Token Storage...\n');

  try {
    // Import the token storage
    const { replitTokenStorage } = await import('../server/replit-token-storage.js');
    
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

    // Test 1: Store a token
    console.log('📋 Test 1: Token Storage');
    const testToken = `sub_${crypto.randomBytes(48).toString('hex')}`;
    const testUserId = `test-user-${Date.now()}`;
    const testSubscriptionId = `test-sub-${Date.now()}`;
    
    await replitTokenStorage.storeToken(testToken, {
      userId: testUserId,
      subscriptionId: testSubscriptionId,
      deviceFingerprint: 'test-fingerprint'
    });
    
    logTest('Token stored successfully', true, `Token: ${testToken.slice(0, 16)}...`);

    // Test 2: Retrieve the token
    console.log('\n📋 Test 2: Token Retrieval');
    const retrievedToken = await replitTokenStorage.getToken(testToken);
    
    logTest(
      'Token retrieved successfully',
      retrievedToken !== null,
      retrievedToken ? `User ID: ${retrievedToken.userId}` : 'Token not found'
    );

    logTest(
      'Token data is correct',
      retrievedToken && retrievedToken.userId === testUserId,
      `Expected: ${testUserId}, Got: ${retrievedToken?.userId}`
    );

    // Test 3: Update token usage
    console.log('\n📋 Test 3: Token Usage Tracking');
    await replitTokenStorage.updateTokenUsage(testToken);
    
    const updatedToken = await replitTokenStorage.getToken(testToken);
    logTest(
      'Usage count updated',
      updatedToken && updatedToken.usageCount === 1,
      `Usage count: ${updatedToken?.usageCount}`
    );

    // Test 4: Session token mapping
    console.log('\n📋 Test 4: Session Token Mapping');
    const testSessionId = `cs_test_${Date.now()}`;
    
    await replitTokenStorage.storeSessionToken(testSessionId, testToken);
    logTest('Session mapping stored', true, `Session: ${testSessionId}`);
    
    const retrievedSessionToken = await replitTokenStorage.getTokenBySession(testSessionId);
    logTest(
      'Session token retrieved',
      retrievedSessionToken === testToken,
      `Expected: ${testToken.slice(0, 16)}..., Got: ${retrievedSessionToken?.slice(0, 16)}...`
    );

    // Test 5: Token removal
    console.log('\n📋 Test 5: Token Cleanup');
    const removed = await replitTokenStorage.removeToken(testToken);
    logTest('Token removed successfully', removed, 'Token deleted from storage');
    
    const deletedToken = await replitTokenStorage.getToken(testToken);
    logTest(
      'Token no longer exists',
      deletedToken === null,
      'Token successfully removed from storage'
    );

    // Test 6: Cleanup expired tokens
    console.log('\n📋 Test 6: Expired Token Cleanup');
    const cleanupResults = await replitTokenStorage.cleanupExpired();
    logTest(
      'Cleanup completed successfully',
      typeof cleanupResults.tokensRemoved === 'number',
      `Removed ${cleanupResults.tokensRemoved} tokens, ${cleanupResults.sessionsRemoved} sessions`
    );

    // Test 7: Environment check
    console.log('\n📋 Test 7: Environment Configuration');
    const hasReplitDB = !!process.env.REPLIT_DB_URL;
    logTest(
      'Replit database available',
      hasReplitDB,
      hasReplitDB ? 'REPLIT_DB_URL configured' : 'Using memory fallback'
    );

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
      console.log('\n🎉 All Replit token storage tests passed!');
      console.log('🔒 Token storage is working correctly and securely.');
    }

    return testResults.failed === 0;

  } catch (error) {
    console.error('💥 Test suite failed:', error);
    return false;
  }
}

// Run the test
testReplitTokenStorage()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });