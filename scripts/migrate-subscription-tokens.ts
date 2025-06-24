#!/usr/bin/env tsx

/**
 * Migration script to create subscription_tokens table
 * Run with: npm run migrate:tokens
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function createSubscriptionTokensTable() {
  console.log('🚀 Creating subscription_tokens table...');
  
  try {
    // Create the subscription_tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token text UNIQUE NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE CASCADE,
        tier_id text NOT NULL,
        device_fingerprint text,
        usage_count integer DEFAULT 0 NOT NULL,
        last_used timestamp DEFAULT NOW() NOT NULL,
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT NOW() NOT NULL,
        updated_at timestamp DEFAULT NOW() NOT NULL
      );
    `);
    
    // Create indexes for better performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_subscription_tokens_token ON subscription_tokens(token);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_subscription_tokens_user_id ON subscription_tokens(user_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_subscription_tokens_expires_at ON subscription_tokens(expires_at);
    `);
    
    console.log('✅ subscription_tokens table created successfully!');
    console.log('✅ Indexes created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating subscription_tokens table:', error);
    throw error;
  }
}

async function main() {
  try {
    await createSubscriptionTokensTable();
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createSubscriptionTokensTable };