#!/usr/bin/env tsx

/**
 * Database migration check script
 * Automatically runs on server startup to ensure database schema is up to date
 */

import { sql } from 'drizzle-orm';
import { db } from '../server/db.js';

export async function checkAndRunMigrations() {
  console.log('🔍 Checking database migrations...');
  
  try {
    // List of required columns for users table
    const requiredColumns = [
      { name: 'suspended_at', type: 'timestamp', addQuery: sql`ALTER TABLE users ADD COLUMN suspended_at timestamp` },
      { name: 'suspension_reason', type: 'text', addQuery: sql`ALTER TABLE users ADD COLUMN suspension_reason text` }
    ];
    
    // Check existing columns
    const checkColumnsQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    
    const existingColumns = await db.execute(checkColumnsQuery);
    const existingColumnNames = new Set(existingColumns.rows.map(row => row.column_name));
    
    let migrationsRun = 0;
    
    // Add missing columns
    for (const column of requiredColumns) {
      if (!existingColumnNames.has(column.name)) {
        console.log(`📝 Adding missing column: ${column.name}...`);
        try {
          await db.execute(column.addQuery);
          console.log(`✅ Added ${column.name} column`);
          migrationsRun++;
        } catch (error) {
          console.error(`❌ Failed to add ${column.name} column:`, error);
          throw error;
        }
      }
    }
    
    if (migrationsRun > 0) {
      console.log(`✅ Applied ${migrationsRun} database migrations`);
    } else {
      console.log('✅ Database schema is up to date');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Migration check failed:', error);
    // Don't throw - allow server to start even if migrations fail
    // This prevents complete outage if database is temporarily unavailable
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkAndRunMigrations()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Migration check script failed:', error);
      process.exit(1);
    });
}