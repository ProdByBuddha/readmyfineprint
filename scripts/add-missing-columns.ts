#!/usr/bin/env tsx

/**
 * Migration script to add missing columns to the database
 * This adds suspended_at and suspension_reason columns to the users table
 */

import { sql } from 'drizzle-orm';
import { db } from '../server/db.js';

async function addMissingColumns() {
  console.log('🔧 Starting database migration to add missing columns...');
  
  try {
    // Check if columns already exist
    const checkColumnsQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('suspended_at', 'suspension_reason')
    `;
    
    const existingColumns = await db.execute(checkColumnsQuery);
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    
    // Add suspended_at column if it doesn't exist
    if (!existingColumnNames.includes('suspended_at')) {
      console.log('📝 Adding suspended_at column...');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN suspended_at timestamp
      `);
      console.log('✅ Added suspended_at column');
    } else {
      console.log('⏭️  suspended_at column already exists');
    }
    
    // Add suspension_reason column if it doesn't exist
    if (!existingColumnNames.includes('suspension_reason')) {
      console.log('📝 Adding suspension_reason column...');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN suspension_reason text
      `);
      console.log('✅ Added suspension_reason column');
    } else {
      console.log('⏭️  suspension_reason column already exists');
    }
    
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addMissingColumns().catch(error => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
}

export { addMissingColumns };