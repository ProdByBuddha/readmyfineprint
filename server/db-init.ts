/**
 * Database initialization helper
 * Ensures database is ready before server starts
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

export async function initializeDatabase() {
  console.log('🔄 Initializing database connection...');
  
  try {
    // Test the connection
    const result = await db.execute(sql`SELECT 1 as test`);
    
    if (result && result.length > 0) {
      console.log('✅ Database connected to Neon');
      return true;
    }
    
    throw new Error('Database connection test failed');
    
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    
    // Check if it's the Neon disabled error
    if (error.message?.includes('endpoint is disabled')) {
      console.log('\n⚠️ Neon database is disabled (likely due to billing)');
      console.log('Please check your Neon dashboard at https://console.neon.tech/');
    }
    
    throw error;
  }
}