#!/usr/bin/env node

/**
 * Script to add 'inactive' status to the user_subscriptions table constraint
 * This modifies the database schema to allow the new status value
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

async function addInactiveStatus() {
  console.log('🔄 Adding "inactive" status to user_subscriptions table...');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // First, check what the current constraint allows
    const checkConstraintQuery = `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'user_subscriptions_status_check';
    `;

    const constraintResult = await pool.query(checkConstraintQuery);
    
    if (constraintResult.rows.length > 0) {
      console.log('📋 Current constraint:', constraintResult.rows[0].definition);
    }

    // Drop the existing constraint
    console.log('🗑️ Dropping existing status constraint...');
    await pool.query(`
      ALTER TABLE user_subscriptions 
      DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
    `);

    // Add new constraint that includes 'inactive'
    console.log('➕ Adding new constraint with "inactive" status...');
    await pool.query(`
      ALTER TABLE user_subscriptions 
      ADD CONSTRAINT user_subscriptions_status_check 
      CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'inactive', 'trialing'));
    `);

    console.log('✅ Successfully updated user_subscriptions table to allow "inactive" status!');

    // Verify the new constraint
    const newConstraintResult = await pool.query(checkConstraintQuery);
    if (newConstraintResult.rows.length > 0) {
      console.log('📋 New constraint:', newConstraintResult.rows[0].definition);
    }

  } catch (error) {
    console.error('❌ Schema update failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the schema update
addInactiveStatus()
  .then(() => {
    console.log('✅ Schema update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Schema update failed:', error);
    process.exit(1);
  });