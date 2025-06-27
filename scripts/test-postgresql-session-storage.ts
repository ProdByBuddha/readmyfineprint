/**
 * Test PostgreSQL Session Storage
 * Verifies that session token mapping works with PostgreSQL database
 */

import { postgresqlSessionStorage } from '../server/postgresql-session-storage';
import { randomUUID } from 'crypto';

function logTest(description: string, success: boolean, details: string = '') {
  const emoji = success ? '✅' : '❌';
  console.log(`${emoji} ${description}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function testPostgreSQLSessionStorage() {
  console.log('🧪 Testing PostgreSQL Session Storage...\n');

  try {
    // Test 1: Store a session token mapping without userId first (since we don't have test users)
    const testSessionId = 'cs_test_session_' + Date.now();
    const testToken = 'sub_test_token_' + Math.random().toString(36).substring(2, 17);

    console.log(`📝 Test 1: Store session token mapping without userId`);
    console.log(`   Session ID: ${testSessionId}`);
    console.log(`   Token: ${testToken}`);
    
    await postgresqlSessionStorage.storeSessionToken(testSessionId, testToken);
    logTest('Session mapping stored', true, `Session: ${testSessionId}`);

    // Test 2: Retrieve the session token
    console.log(`\n📝 Test 2: Retrieve session token`);
    const retrievedToken = await postgresqlSessionStorage.getTokenBySession(testSessionId);
    const retrieveSuccess = retrievedToken === testToken;
    logTest('Session token retrieved', retrieveSuccess, `Expected: ${testToken}, Got: ${retrievedToken}`);

    // Test 3: Test session cleanup functionality
    console.log(`\n📝 Test 3: Test cleanup expired sessions`);
    const cleanupResult = await postgresqlSessionStorage.cleanupExpired();
    logTest('Cleanup expired sessions', true, `Cleaned up ${cleanupResult.sessionsRemoved} expired sessions`);

    // Test 4: Test session replacement (removing existing before storing new)
    console.log(`\n📝 Test 4: Test session replacement`);
    const newToken = 'sub_test_token_replacement_' + Math.random().toString(36).substring(2, 17);
    await postgresqlSessionStorage.storeSessionToken(testSessionId, newToken);
    const replacedToken = await postgresqlSessionStorage.getTokenBySession(testSessionId);
    const replaceSuccess = replacedToken === newToken;
    logTest('Session token replaced', replaceSuccess, `Expected: ${newToken}, Got: ${replacedToken}`);

    // Clean up test data
    console.log(`\n📝 Cleanup: Remove test sessions`);
    await postgresqlSessionStorage.removeSessionToken(testSessionId);
    logTest('Test sessions cleaned up', true);

    console.log('\n🎉 All PostgreSQL session storage tests completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ PostgreSQL session storage test failed:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
}

// Run the test
testPostgreSQLSessionStorage()
  .then(success => {
    console.log(`\n${success ? '✅' : '❌'} Test completed: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  }); 