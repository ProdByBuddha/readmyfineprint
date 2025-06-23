
#!/usr/bin/env node

/**
 * Migration script to convert existing bcrypt passwords to Argon2id
 * This script will prompt users to re-enter their passwords on next login
 * and automatically convert them to Argon2id hashing
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migratePasswords() {
  console.log('🔐 Starting password migration to Argon2id...\n');

  try {
    // Check current password format
    const result = await pool.query(
      'SELECT id, email, hashed_password FROM users WHERE hashed_password IS NOT NULL'
    );

    console.log(`Found ${result.rows.length} users with passwords`);

    let bcryptCount = 0;
    let argon2Count = 0;
    let unknownCount = 0;

    for (const user of result.rows) {
      const hash = user.hashed_password;
      
      if (hash.startsWith('$2b$') || hash.startsWith('$2a$') || hash.startsWith('$2y$')) {
        bcryptCount++;
        console.log(`📧 ${user.email}: bcrypt (will be migrated on next login)`);
      } else if (hash.startsWith('$argon2id$')) {
        argon2Count++;
        console.log(`📧 ${user.email}: already Argon2id ✅`);
      } else {
        unknownCount++;
        console.log(`📧 ${user.email}: unknown format ⚠️`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Already Argon2id: ${argon2Count}`);
    console.log(`🔄 Will migrate on login: ${bcryptCount}`);
    console.log(`⚠️  Unknown format: ${unknownCount}`);

    if (bcryptCount > 0) {
      console.log('\n📝 Next Steps:');
      console.log('1. Deploy the updated authentication code');
      console.log('2. Users will be automatically migrated when they log in');
      console.log('3. No action required from users');
      console.log('\n🔒 Security Benefits:');
      console.log('- Argon2id is more resistant to GPU attacks');
      console.log('- Better memory-hard function');
      console.log('- Salt and pepper protection');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Add backward compatibility for bcrypt verification
export async function verifyLegacyPassword(password: string, hash: string): Promise<boolean> {
  // Check if it's a bcrypt hash
  if (hash.startsWith('$2b$') || hash.startsWith('$2a$') || hash.startsWith('$2y$')) {
    try {
      const bcrypt = await import('bcrypt');
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Legacy bcrypt verification failed:', error);
      return false;
    }
  }
  
  // Not a bcrypt hash, return false
  return false;
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migratePasswords();
}
