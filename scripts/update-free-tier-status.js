#!/usr/bin/env node

/**
 * Simple script to update free tier subscription status to 'inactive'
 * Run with: node scripts/update-free-tier-status.js
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

async function updateFreeSubscriptionStatus() {
  console.log('🔄 Updating free tier subscription status to inactive...');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Update existing free tier subscriptions to 'inactive' status
    const updateQuery = `
      UPDATE user_subscriptions 
      SET status = 'inactive', updated_at = NOW() 
      WHERE tier_id = 'free' AND status != 'inactive'
      RETURNING id, user_id, status;
    `;

    const result = await pool.query(updateQuery);
    
    console.log(`✅ Updated ${result.rowCount} free tier subscriptions to 'inactive' status`);
    
    if (result.rows.length > 0) {
      console.log('📋 Updated subscriptions:');
      result.rows.forEach(row => {
        console.log(`  - Subscription ID: ${row.id}, User ID: ${row.user_id}, Status: ${row.status}`);
      });
    }

    // Check total inactive free subscriptions
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM user_subscriptions 
      WHERE tier_id = 'free' AND status = 'inactive';
    `;
    
    const countResult = await pool.query(countQuery);
    console.log(`📊 Total inactive free tier subscriptions: ${countResult.rows[0].total}`);

    console.log('🎉 Update completed successfully!');

  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the update
updateFreeSubscriptionStatus()
  .then(() => {
    console.log('✅ Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });