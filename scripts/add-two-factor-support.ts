#!/usr/bin/env tsx

/**
 * Add Two-Factor Authentication Support
 * 
 * This script adds the necessary database tables and columns for 2FA support:
 * - Adds twoFactorEnabled, backupEmail columns to users table
 * - Creates twoFactorCodes table for verification codes
 */

import { db, initializeDatabase } from '../server/db-with-fallback';

async function addTwoFactorSupport() {
  console.log('🔐 Adding Two-Factor Authentication support...');
  
  // Initialize database connection
  await initializeDatabase();

  try {
    // Add 2FA columns to users table
    console.log('📝 Adding 2FA columns to users table...');
    
    await db.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS backup_email TEXT;
    `);

    console.log('✅ Added 2FA columns to users table');

    // Create two_factor_codes table
    console.log('📝 Creating two_factor_codes table...');
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS two_factor_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        email TEXT NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        max_attempts INTEGER DEFAULT 3 NOT NULL,
        is_used BOOLEAN DEFAULT false NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log('✅ Created two_factor_codes table');

    // Create indexes for performance
    console.log('📝 Creating indexes...');
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user_id 
      ON two_factor_codes(user_id);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user_type_active 
      ON two_factor_codes(user_id, type, is_used, expires_at);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_two_factor_codes_expires_at 
      ON two_factor_codes(expires_at);
    `);

    console.log('✅ Created indexes');

    // Test the new tables
    console.log('🧪 Testing new tables...');
    
    const testResult = await db.execute(`
      SELECT 
        COUNT(*) as user_count,
        SUM(CASE WHEN two_factor_enabled THEN 1 ELSE 0 END) as users_with_2fa
      FROM users;
    `);

    const codeTableTest = await db.execute(`
      SELECT COUNT(*) as code_count FROM two_factor_codes;
    `);

    console.log('📊 Test Results:');
    console.log(`   Users: ${testResult.rows?.[0]?.user_count || testResult[0]?.user_count || 0}`);
    console.log(`   Users with 2FA: ${testResult.rows?.[0]?.users_with_2fa || testResult[0]?.users_with_2fa || 0}`);
    console.log(`   2FA codes: ${codeTableTest.rows?.[0]?.code_count || codeTableTest[0]?.code_count || 0}`);

    console.log('✅ Two-Factor Authentication support added successfully!');
    console.log('');
    console.log('🔐 2FA Features Available:');
    console.log('   • Email-based verification codes');
    console.log('   • Security questions as backup');
    console.log('   • Backup email support');
    console.log('   • Rate limiting and security logging');
    console.log('   • Automatic cleanup of expired codes');
    console.log('');
    console.log('💡 Users can now:');
    console.log('   • Enable 2FA with backup email');
    console.log('   • Receive verification codes via email');
    console.log('   • Use security questions as fallback');
    console.log('   • Manage 2FA settings in their account');

  } catch (error) {
    console.error('❌ Error adding 2FA support:', error);
    throw error;
  }
}

// Run the migration
addTwoFactorSupport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

export { addTwoFactorSupport };