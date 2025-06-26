#!/usr/bin/env tsx
/**
 * Check current database status and connection
 */

import { db, getDatabaseStatus } from '../server/db';
import { sql } from 'drizzle-orm';

async function checkDatabaseStatus() {
  console.log('🔍 Checking database status...\n');
  
  // Wait a bit for the database to initialize if using fallback
  if (process.env.USE_DB_FALLBACK === 'true' || process.env.NODE_ENV === 'development') {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  try {
    // Get current status
    const status = getDatabaseStatus ? getDatabaseStatus() : {
      isUsingLocalDb: false,
      neonIsDisabled: false,
      currentDatabase: 'Unknown',
      localDatabaseUrl: 'N/A',
    };
    
    console.log('📊 Database Status:');
    console.log('  Current Database:', status.currentDatabase);
    console.log('  Using Local DB:', status.isUsingLocalDb ? '✅ Yes' : '❌ No');
    console.log('  Neon Disabled:', status.neonIsDisabled ? '⚠️ Yes' : '✅ No');
    
    if (status.isUsingLocalDb) {
      console.log('  Local DB URL:', status.localDatabaseUrl);
    }
    
    // Try to run a health check query
    console.log('\n🏥 Running health check...');
    
    const result = await db.execute(sql`SELECT 
      current_database() as database,
      current_user as user,
      version() as version,
      NOW() as current_time`);
    
    if (result && result.length > 0) {
      const info = result[0];
      console.log('\n✅ Database is healthy!');
      console.log('  Database:', info.database);
      console.log('  User:', info.user);
      console.log('  Version:', info.version?.split('\n')[0]);
      console.log('  Server Time:', new Date(info.current_time).toLocaleString());
    }
    
    // Check table counts
    console.log('\n📋 Table Statistics:');
    
    const tables = [
      { name: 'users', query: sql`SELECT COUNT(*) as count FROM users` },
      { name: 'user_subscriptions', query: sql`SELECT COUNT(*) as count FROM user_subscriptions` },
      { name: 'usage_records', query: sql`SELECT COUNT(*) as count FROM usage_records` },
      { name: 'subscription_tokens', query: sql`SELECT COUNT(*) as count FROM subscription_tokens` },
      { name: 'consent_records', query: sql`SELECT COUNT(*) as count FROM consent_records` },
    ];
    
    for (const table of tables) {
      try {
        const result = await db.execute(table.query);
        console.log(`  ${table.name}: ${result[0].count} records`);
      } catch (error) {
        console.log(`  ${table.name}: ❌ Error accessing table`);
      }
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('\n❌ Database check failed:', error);
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('  1. If using local PostgreSQL, ensure it\'s running:');
    console.log('     - macOS: brew services start postgresql');
    console.log('     - Linux: sudo systemctl start postgresql');
    console.log('     - Docker: docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres');
    console.log('  2. Run setup script: npm run db:setup-local');
    console.log('  3. Check DATABASE_URL and LOCAL_DATABASE_URL environment variables');
    
    process.exit(1);
  }
}

// Run the check
checkDatabaseStatus().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});