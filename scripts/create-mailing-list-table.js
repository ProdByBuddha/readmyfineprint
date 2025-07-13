/**
 * Migration: Create Mailing List Table
 * Creates the mailing_list table for collecting email subscriptions
 */

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function createMailingListTable() {
  console.log('📧 Creating mailing list table...');

  try {
    // Create mailing_list table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mailing_list (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        subscription_type TEXT NOT NULL,
        source TEXT DEFAULT 'subscription_plans',
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
        ip_hash TEXT,
        user_agent_hash TEXT,
        unsubscribe_token TEXT UNIQUE,
        unsubscribed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);

    console.log('✅ Created mailing_list table');

    // Create indexes for performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mailing_list_email_subscription 
      ON mailing_list(email, subscription_type)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mailing_list_user_id 
      ON mailing_list(user_id) WHERE user_id IS NOT NULL
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mailing_list_status 
      ON mailing_list(status)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mailing_list_created_at 
      ON mailing_list(created_at)
    `);

    console.log('✅ Created indexes for mailing_list table');

    console.log('\n🎉 Mailing list table created successfully!');
    console.log('\nTable structure:');
    console.log('  - id: UUID primary key');
    console.log('  - email: User email address');
    console.log('  - user_id: Optional reference to users table');
    console.log('  - subscription_type: Type of subscription (enterprise, etc.)');
    console.log('  - source: Source of signup (subscription_plans, etc.)');
    console.log('  - status: active or unsubscribed');
    console.log('  - ip_hash: Hashed IP address for privacy');
    console.log('  - user_agent_hash: Hashed user agent for privacy');
    console.log('  - unsubscribe_token: Unique token for unsubscribe links');
    console.log('  - timestamps: created_at, updated_at, unsubscribed_at');

  } catch (error) {
    console.error('❌ Failed to create mailing_list table:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Table already exists - migration may have been run previously');
        return true;
      }
    }
    
    throw error;
  }
}

// Run the migration
createMailingListTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }); 