/**
 * Simple PostgreSQL Session Storage Test
 * Debug version to isolate issues
 */

import { postgresqlSessionStorage } from '../server/postgresql-session-storage';
import { randomUUID } from 'crypto';

async function simpleTest() {
  console.log('🧪 Simple PostgreSQL Session Storage Test...\n');

  try {
    console.log('Environment check:');
    console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('  NODE_ENV:', process.env.NODE_ENV);

    // Test database connection first
    console.log('\n0. Testing database connection...');
    const { db } = await import('../server/db');
    console.log('✅ Database connection imported');

    // Test with valid UUID
    const sessionId = 'test_session_' + Date.now();
    const token = 'test_token_' + Date.now();
    const userId = randomUUID();

    console.log('\nTesting with:');
    console.log('  SessionId:', sessionId);
    console.log('  Token:', token);
    console.log('  UserId:', userId);
    console.log('  UserId type:', typeof userId);
    console.log('  UserId length:', userId.length);

    // Store
    console.log('\n1. Storing session...');
    await postgresqlSessionStorage.storeSessionToken(sessionId, token, userId);
    console.log('✅ Store successful');

    // Retrieve
    console.log('\n2. Retrieving session...');
    const retrieved = await postgresqlSessionStorage.getTokenBySession(sessionId);
    console.log('✅ Retrieved:', retrieved);
    console.log('✅ Match:', retrieved === token);

    // Cleanup
    console.log('\n3. Cleaning up...');
    await postgresqlSessionStorage.removeSessionToken(sessionId);
    console.log('✅ Cleanup successful');

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

simpleTest(); 