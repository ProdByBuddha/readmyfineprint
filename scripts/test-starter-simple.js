#!/usr/bin/env node

/**
 * Simple test script for starter subscription system
 * Tests database structure and basic subscription functionality
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper function to generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Starter tier configuration (copied from subscription-tiers.ts)
const STARTER_TIER = {
  id: "starter",
  name: "Starter",
  description: "For individuals and teams who need faster processing with advanced AI",
  model: "gpt-4.1-mini",
  monthlyPrice: 15,
  yearlyPrice: 150,
  limits: {
    documentsPerMonth: -1, // unlimited
    tokensPerDocument: 128000,
    prioritySupport: false,
    advancedAnalysis: true,
    apiAccess: false,
    customIntegrations: false,
  }
};

async function testStarterSubscription() {
  console.log('🧪 Testing Starter Subscription System...\n');

  const testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  let testUserId = null; // For cleanup

  function logTest(name, passed, details) {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}`);
    if (details) console.log(`   ${details}`);
    
    testResults.tests.push({ name, passed, details });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }

  try {
    // Test 1: Database connection and schema
    console.log('📋 Test 1: Database Schema');
    
    const tablesQuery = `
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const tables = await pool.query(tablesQuery);
    const tableNames = tables.rows.map(row => row.table_name);
    
    logTest(
      'Required tables exist',
      tableNames.includes('users') && tableNames.includes('user_subscriptions') && tableNames.includes('usage_records'),
      `Found tables: ${tableNames.join(', ')}`
    );

    // Test 2: Check subscription status constraint
    const constraintQuery = `
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'user_subscriptions_status_check';
    `;
    const constraint = await pool.query(constraintQuery);
    const hasInactive = constraint.rows.length > 0 && constraint.rows[0].definition.includes('inactive');
    
    logTest(
      'Database allows "inactive" status',
      hasInactive,
      hasInactive ? 'Constraint includes inactive status' : 'Constraint missing or incomplete'
    );

    // Test 3: Create test user
    console.log('\n📋 Test 2: User Creation and Management');
    testUserId = generateUUID();
    const testEmail = `test-${Date.now()}@example.com`;

    await pool.query(`
      INSERT INTO users (id, email, username, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
    `, [testUserId, testEmail, 'test-starter-user']);

    logTest('Test user created', true, `User ID: ${testUserId}`);

    // Test 4: Create inactive free tier subscription (default for new users)
    console.log('\n📋 Test 3: Free Tier Subscription');
    
    const freeSubId = generateUUID();
    await pool.query(`
      INSERT INTO user_subscriptions 
      (id, user_id, tier_id, status, current_period_start, current_period_end, created_at, updated_at)
      VALUES ($1, $2, 'free', 'inactive', NOW(), NOW() + INTERVAL '1 year', NOW(), NOW())
    `, [freeSubId, testUserId]);

    logTest('Free tier subscription created', true, `Subscription ID: ${freeSubId}`);

    // Test 5: Create active starter subscription
    console.log('\n📋 Test 4: Starter Subscription Creation');
    
    const starterSubId = generateUUID();
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // First, cancel the free subscription
    await pool.query(`
      UPDATE user_subscriptions 
      SET status = 'canceled', updated_at = NOW()
      WHERE id = $1
    `, [freeSubId]);

    // Create starter subscription
    await pool.query(`
      INSERT INTO user_subscriptions 
      (id, user_id, tier_id, status, stripe_customer_id, stripe_subscription_id,
       current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
      VALUES ($1, $2, 'starter', 'active', $3, $4, $5, $6, false, NOW(), NOW())
    `, [
      starterSubId, 
      testUserId, 
      `cus_test_${Date.now()}`, 
      `sub_test_${Date.now()}`,
      periodStart,
      periodEnd
    ]);

    logTest('Starter subscription created', true, `Subscription ID: ${starterSubId}`);

    // Test 6: Verify subscription retrieval
    console.log('\n📋 Test 5: Subscription Retrieval');
    
    const userSubQuery = `
      SELECT * FROM user_subscriptions 
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `;
    const userSub = await pool.query(userSubQuery, [testUserId]);
    
    logTest(
      'Active subscription retrieved',
      userSub.rows.length > 0 && userSub.rows[0].tier_id === 'starter',
      `Tier: ${userSub.rows[0]?.tier_id}, Status: ${userSub.rows[0]?.status}`
    );

    // Test 7: Usage tracking
    console.log('\n📋 Test 6: Usage Tracking');
    
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const usageId = generateUUID();
    
    await pool.query(`
      INSERT INTO usage_records 
      (id, user_id, subscription_id, period, documents_analyzed, tokens_used, cost, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 1, 1000, '0.00135', NOW(), NOW())
    `, [usageId, testUserId, starterSubId, currentPeriod]);

    logTest('Usage record created', true, `Usage ID: ${usageId}`);

    // Verify usage retrieval
    const usageQuery = `
      SELECT * FROM usage_records 
      WHERE user_id = $1 AND period = $2
    `;
    const usage = await pool.query(usageQuery, [testUserId, currentPeriod]);
    
    logTest(
      'Usage record retrieved',
      usage.rows.length > 0 && usage.rows[0].documents_analyzed === 1,
      `Documents: ${usage.rows[0]?.documents_analyzed}, Tokens: ${usage.rows[0]?.tokens_used}, Cost: $${usage.rows[0]?.cost}`
    );

    // Test 8: Subscription expiration handling
    console.log('\n📋 Test 7: Subscription Expiration');
    
    // Update subscription to be expired
    await pool.query(`
      UPDATE user_subscriptions 
      SET current_period_end = NOW() - INTERVAL '1 day', updated_at = NOW()
      WHERE id = $1
    `, [starterSubId]);

    const expiredSubQuery = `
      SELECT *, (current_period_end < NOW()) as is_expired
      FROM user_subscriptions 
      WHERE id = $1
    `;
    const expiredSub = await pool.query(expiredSubQuery, [starterSubId]);
    
    logTest(
      'Expired subscription detected',
      expiredSub.rows.length > 0 && expiredSub.rows[0].is_expired,
      `Subscription expired: ${expiredSub.rows[0]?.is_expired}`
    );

    // Test 9: Multiple subscription handling
    console.log('\n📋 Test 8: Multiple Subscription Handling');
    
    const allUserSubsQuery = `
      SELECT tier_id, status, COUNT(*) as count
      FROM user_subscriptions 
      WHERE user_id = $1
      GROUP BY tier_id, status
      ORDER BY tier_id, status
    `;
    const allSubs = await pool.query(allUserSubsQuery, [testUserId]);
    
    logTest(
      'User subscription history tracked',
      allSubs.rows.length > 0,
      `Subscriptions: ${allSubs.rows.map(r => `${r.tier_id}(${r.status}): ${r.count}`).join(', ')}`
    );

    // Test 10: Data integrity
    console.log('\n📋 Test 9: Data Integrity');
    
    const integrityQuery = `
      SELECT 
        u.id as user_id,
        u.email,
        COUNT(us.id) as subscription_count,
        COUNT(ur.id) as usage_records_count
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      LEFT JOIN usage_records ur ON u.id = ur.user_id
      WHERE u.id = $1
      GROUP BY u.id, u.email
    `;
    const integrity = await pool.query(integrityQuery, [testUserId]);
    
    logTest(
      'Data relationships maintained',
      integrity.rows.length > 0 && integrity.rows[0].subscription_count > 0,
      `User has ${integrity.rows[0]?.subscription_count} subscriptions and ${integrity.rows[0]?.usage_records_count} usage records`
    );

    // Test 11: Environment configuration
    console.log('\n📋 Test 10: Environment Configuration');
    
    const hasRequiredEnvVars = !!(
      process.env.DATABASE_URL &&
      process.env.STRIPE_SECRET_KEY &&
      process.env.VITE_STRIPE_PUBLIC_KEY
    );
    
    logTest(
      'Required environment variables present',
      hasRequiredEnvVars,
      hasRequiredEnvVars ? 'All required vars found' : 'Missing DATABASE_URL, STRIPE_SECRET_KEY, or VITE_STRIPE_PUBLIC_KEY'
    );

  } catch (error) {
    logTest('Test execution', false, `Error: ${error.message}`);
    console.error('💥 Test error:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    try {
      if (testUserId) {
        await pool.query('DELETE FROM usage_records WHERE user_id = $1', [testUserId]);
        await pool.query('DELETE FROM user_subscriptions WHERE user_id = $1', [testUserId]);
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        console.log('✅ Test data cleaned up');
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }

    await pool.end();
  }

  // Print summary
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

// Run the test
testStarterSubscription()
  .then((success) => {
    if (success) {
      console.log('\n🎉 All starter subscription tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });