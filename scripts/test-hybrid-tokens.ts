#!/usr/bin/env tsx

/**
 * Test script to demonstrate hybrid token system
 * Tests both JOSE and PostgreSQL token generation and validation
 */

import { hybridTokenService } from '../server/hybrid-token-service';
import { joseTokenService } from '../server/jose-token-service';
import { postgresqlTokenStorage } from '../server/postgresql-token-storage';

async function testHybridTokens() {
  console.log('🧪 Testing Hybrid Token System\n');
  
  const testUserId = 'test-user-123';
  const testSubscriptionId = 'test-sub-456';
  const testTierId = 'starter';
  
  try {
    // Test 1: Generate a token using hybrid service (should prefer JOSE)
    console.log('📝 Test 1: Generating hybrid token (should be JOSE)...');
    const hybridToken = await hybridTokenService.generateSubscriptionToken({
      userId: testUserId,
      subscriptionId: testSubscriptionId,
      tierId: testTierId,
      deviceFingerprint: 'test-device-123'
    });
    
    console.log(`✅ Generated token: ${hybridToken.slice(0, 50)}...`);
    
    // Check token type
    const tokenInfo = await hybridTokenService.getTokenInfo(hybridToken);
    console.log(`🔍 Token type: ${tokenInfo?.type}`);
    console.log(`👤 User ID: ${tokenInfo?.userId}`);
    console.log(`🎫 Tier ID: ${tokenInfo?.tierId}\n`);
    
    // Test 2: Validate the token
    console.log('✅ Test 2: Validating hybrid token...');
    const validationResult = await hybridTokenService.validateSubscriptionToken(hybridToken);
    
    if (validationResult) {
      console.log(`✅ Token valid for user: ${validationResult.userId}`);
      console.log(`🎯 Tier: ${validationResult.tierId}`);
      console.log(`⏰ Expires: ${validationResult.expiresAt}\n`);
    } else {
      console.log('❌ Token validation failed\n');
    }
    
    // Test 3: Test different token types
    console.log('📝 Test 3: Generating JOSE token directly...');
    const joseToken = await joseTokenService.generateSubscriptionToken({
      userId: testUserId,
      tierId: testTierId,
      deviceFingerprint: 'jose-test-device'
    });
    console.log(`✅ JOSE token: ${joseToken.slice(0, 50)}...`);
    
    // Test 4: Create a legacy PostgreSQL token
    console.log('📝 Test 4: Generating PostgreSQL token directly...');
    const crypto = await import('crypto');
    const tokenBytes = crypto.randomBytes(48);
    const pgToken = `sub_${tokenBytes.toString('hex')}`;
    
    await postgresqlTokenStorage.storeToken(pgToken, {
      userId: testUserId,
      subscriptionId: testSubscriptionId,
      tierId: testTierId,
      deviceFingerprint: 'pg-test-device'
    });
    console.log(`✅ PostgreSQL token: ${pgToken.slice(0, 50)}...`);
    
    // Test 5: Validate both token types through hybrid service
    console.log('\n🔍 Test 5: Validating both token types...');
    
    const joseValidation = await hybridTokenService.validateSubscriptionToken(joseToken);
    const pgValidation = await hybridTokenService.validateSubscriptionToken(pgToken);
    
    console.log(`JOSE validation: ${joseValidation ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`PostgreSQL validation: ${pgValidation ? '✅ Valid' : '❌ Invalid'}`);
    
    // Test 6: Token info for both types
    console.log('\n📊 Test 6: Token information...');
    const joseInfo = await hybridTokenService.getTokenInfo(joseToken);
    const pgInfo = await hybridTokenService.getTokenInfo(pgToken);
    
    console.log(`JOSE token info: ${JSON.stringify(joseInfo, null, 2)}`);
    console.log(`PostgreSQL token info: ${JSON.stringify(pgInfo, null, 2)}`);
    
    // Test 7: Token stats
    console.log('\n📈 Test 7: Token statistics...');
    const stats = await hybridTokenService.getTokenStats();
    console.log(`Token stats: ${JSON.stringify(stats, null, 2)}`);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testHybridTokens().then(() => process.exit(0)).catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { testHybridTokens };