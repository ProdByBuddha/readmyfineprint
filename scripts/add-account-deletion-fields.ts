/**
 * Migration: Add Account Deletion Fields to Users Table
 * Adds soft delete fields to support GDPR/CCPA compliant account deletion
 */

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function addAccountDeletionFields() {
  console.log('🔄 Adding account deletion fields to users table...');

  try {
    // Add the new columns to the users table
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deletion_reason TEXT
    `;

    console.log('✅ Successfully added account deletion fields:');
    console.log('   - is_deleted (boolean, default: false)');
    console.log('   - deleted_at (timestamp, nullable)');
    console.log('   - deletion_reason (text, nullable)');

    // Create an index for querying active users efficiently
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_active 
      ON users (is_deleted, is_active) 
      WHERE is_deleted = FALSE
    `;

    console.log('✅ Created index for efficient active user queries');

    // Verify the changes
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('is_deleted', 'deleted_at', 'deletion_reason')
      ORDER BY column_name
    `;

    console.log('\n📋 Verified new columns:');
    tableInfo.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Deploy the updated schema.ts file');
    console.log('2. Test the account deletion API endpoints');
    console.log('3. Update any existing queries to filter out deleted users');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nPlease check:');
    console.error('1. DATABASE_URL is correctly set');
    console.error('2. Database connection is working');
    console.error('3. You have ALTER TABLE permissions');
    process.exit(1);
  }
}

// Run the migration
addAccountDeletionFields()
  .then(() => {
    console.log('\n✅ Account deletion migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration execution failed:', error);
    process.exit(1);
  });