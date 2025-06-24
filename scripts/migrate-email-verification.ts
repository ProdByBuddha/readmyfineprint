#!/usr/bin/env tsx

/**
 * Migrate email verification from Replit storage to PostgreSQL
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function migrateEmailVerification() {
  console.log('🔄 Creating email verification tables...\n');
  
  try {
    // Create email verification codes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        client_ip TEXT NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        max_attempts INTEGER DEFAULT 3 NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    console.log('✅ Created email_verification_codes table');
    
    // Create email verification rate limit table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_verification_rate_limit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        client_ip TEXT NOT NULL,
        attempts INTEGER DEFAULT 1 NOT NULL,
        window_start TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    console.log('✅ Created email_verification_rate_limit table');
    
    // Create indexes for better performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email_device 
      ON email_verification_codes(email, device_fingerprint);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at 
      ON email_verification_codes(expires_at);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_email_verification_rate_limit_email_ip 
      ON email_verification_rate_limit(email, client_ip);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_email_verification_rate_limit_window_start 
      ON email_verification_rate_limit(window_start);
    `);
    
    console.log('✅ Created indexes for email verification tables');
    
    console.log('\n🎉 Email verification migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateEmailVerification().then(() => process.exit(0)).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { migrateEmailVerification };