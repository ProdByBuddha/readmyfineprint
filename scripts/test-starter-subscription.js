#!/usr/bin/env node

/**
 * Comprehensive test script for the starter subscription system
 * Tests subscription creation, validation, usage tracking, and tier enforcement
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
// We'll import the subscription service and tiers differently
// Since this is a test script, we'll recreate the key functions we need

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testStarterSubscription() {
  console.log('🧪 Starting Starter Subscription System Tests...\n');

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

  try {
    // Test 1: Verify starter tier configuration
    console.log('📋 Test 1: Starter Tier Configuration');
    const starterTier = getTierById('starter');
    
    logTest(
      'Starter tier exists',
      starterTier !== undefined,
      starterTier ? `Found: ${starterTier.name} - $${starterTier.monthlyPrice}/month` : 'Not found'
    );

    logTest(
      'Starter tier has correct properties',
      starterTier && starterTier.id === 'starter' && starterTier.monthlyPrice === 15,
      `Price: $${starterTier?.monthlyPrice}, Model: ${starterTier?.model}`
    );

    logTest(
      'Starter tier has unlimited documents',
      starterTier && starterTier.limits.documentsPerMonth === -1,
      `Documents per month: ${starterTier?.limits.documentsPerMonth}`
    );

    // Test 2: Create a test user for subscription testing
    console.log('\n📋 Test 2: Test User Creation');
    const testUserId = `test-user-${Date.now()}`;
    const testUserEmail = `test-${Date.now()}@example.com`;

    try {
      await pool.query(`
        INSERT INTO users (id, email, username, hashed_password, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [testUserId, testUserEmail, 'test-starter-user', 'fake-hash']);

      logTest('Test user created', true, `User ID: ${testUserId}`);
    } catch (error) {
      logTest('Test user creation', false, `Error: ${error.message}`);
      return;
    }

    // Test 3: Test subscription service methods
    console.log('\n📋 Test 3: Subscription Service Methods');

    try {
      const userSubData = await subscriptionService.getUserSubscriptionWithUsage(testUserId);
      
      logTest(
        'getUserSubscriptionWithUsage works',
        userSubData && userSubData.tier,
        `Tier: ${userSubData.tier.name}, Usage: ${userSubData.usage.documentsAnalyzed} docs`
      );

      logTest(
        'New user gets free tier initially',
        userSubData.tier.id === 'free',
        `Assigned tier: ${userSubData.tier.id}`
      );

      logTest(
        'New user has inactive subscription',
        userSubData.subscription && userSubData.subscription.status === 'inactive',
        `Subscription status: ${userSubData.subscription?.status}`
      );

    } catch (error) {
      logTest('Subscription service test', false, `Error: ${error.message}`);
    }

    // Test 4: Test tier validation logic
    console.log('\n📋 Test 4: Tier Validation Logic');

    try {
      // Create a mock active subscription for starter tier
      const mockSubscription = {
        id: `test-sub-${Date.now()}`,
        userId: testUserId,
        tierId: 'starter',
        status: 'active',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert test subscription
      await pool.query(`
        INSERT INTO user_subscriptions 
        (id, user_id, tier_id, status, stripe_customer_id, stripe_subscription_id, 
         current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        mockSubscription.id,
        mockSubscription.userId,
        mockSubscription.tierId,
        mockSubscription.status,
        mockSubscription.stripeCustomerId,
        mockSubscription.stripeSubscriptionId,
        mockSubscription.currentPeriodStart,
        mockSubscription.currentPeriodEnd,
        mockSubscription.cancelAtPeriodEnd
      ]);

      logTest('Mock starter subscription created', true, `Subscription ID: ${mockSubscription.id}`);

      // Test subscription retrieval
      const updatedUserData = await subscriptionService.getUserSubscriptionWithUsage(testUserId);
      
      logTest(
        'User now has starter tier',
        updatedUserData.tier.id === 'starter',
        `Tier: ${updatedUserData.tier.id}, Status: ${updatedUserData.subscription?.status}`
      );

      logTest(
        'Starter tier has correct model',
        updatedUserData.tier.model === 'gpt-4.1-mini',
        `Model: ${updatedUserData.tier.model}`
      );

    } catch (error) {
      logTest('Tier validation test', false, `Error: ${error.message}`);
    }

    // Test 5: Test usage tracking
    console.log('\n📋 Test 5: Usage Tracking');

    try {
      await subscriptionService.trackUsage(testUserId, 1000, 'gpt-4.1-mini');
      logTest('Usage tracking works', true, 'Tracked 1000 tokens');

      const usageData = await subscriptionService.getUserSubscriptionWithUsage(testUserId);
      
      logTest(
        'Usage is recorded correctly',
        usageData.usage.tokensUsed >= 1000,
        `Tokens used: ${usageData.usage.tokensUsed}, Documents: ${usageData.usage.documentsAnalyzed}`
      );

      logTest(
        'Usage cost is calculated',
        usageData.usage.cost > 0,
        `Cost: $${usageData.usage.cost}`
      );

    } catch (error) {
      logTest('Usage tracking test', false, `Error: ${error.message}`);
    }

    // Test 6: Test subscription audit
    console.log('\n📋 Test 6: Subscription Audit');

    try {
      const auditResult = await subscriptionService.auditSubscriptionTiers();
      
      logTest(
        'Subscription audit runs successfully',
        auditResult && typeof auditResult.totalUsers === 'number',
        `Total users: ${auditResult.totalUsers}, Issues: ${auditResult.issues.length}`
      );

      logTest(
        'Audit finds users correctly',
        auditResult.totalUsers > 0,
        `Free users: ${auditResult.freeUsersCount}, Paid users: ${auditResult.paidUsersCount}`
      );

    } catch (error) {
      logTest('Subscription audit test', false, `Error: ${error.message}`);
    }

    // Test 7: Test tier enforcement
    console.log('\n📋 Test 7: Tier Enforcement');

    try {
      // Test expired subscription (set end date to past)
      await pool.query(`
        UPDATE user_subscriptions 
        SET current_period_end = $1, updated_at = NOW()
        WHERE user_id = $2 AND tier_id = 'starter'
      `, [new Date(Date.now() - 24 * 60 * 60 * 1000), testUserId]); // Yesterday

      const expiredUserData = await subscriptionService.getUserSubscriptionWithUsage(testUserId);
      
      logTest(
        'Expired subscription downgrades to free',
        expiredUserData.tier.id === 'free',
        `Tier after expiration: ${expiredUserData.tier.id}`
      );

    } catch (error) {
      logTest('Tier enforcement test', false, `Error: ${error.message}`);
    }

    // Test 8: Test Stripe integration readiness
    console.log('\n📋 Test 8: Stripe Integration Readiness');

    const hasStripeKeys = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
    logTest(
      'Stripe environment variables configured',
      hasStripeKeys,
      hasStripeKeys ? 'Stripe keys found' : 'Missing STRIPE_SECRET_KEY or STRIPE_PUBLISHABLE_KEY'
    );

    try {
      await subscriptionService.initializeStripeProducts();
      logTest('Stripe products initialization', true, 'Stripe products can be initialized');
    } catch (error) {
      logTest('Stripe products initialization', false, `Error: ${error.message}`);
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error);
  } finally {
    // Cleanup: Remove test user and subscriptions
    console.log('\n🧹 Cleaning up test data...');
    try {
      await pool.query('DELETE FROM user_subscriptions WHERE user_id LIKE $1', ['test-user-%']);
      await pool.query('DELETE FROM usage_records WHERE user_id LIKE $1', ['test-user-%']);
      await pool.query('DELETE FROM users WHERE id LIKE $1', ['test-user-%']);
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }

    await pool.end();
  }

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

  return testResults.failed === 0;
}

// Run the test suite
testStarterSubscription()
  .then((success) => {
    if (success) {
      console.log('\n🎉 All starter subscription tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed. Please review the results above.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });