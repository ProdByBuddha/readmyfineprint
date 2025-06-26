/**
 * Database initialization helper
 * Ensures database is ready before server starts
 */

import { db, getDatabaseStatus } from './db';
import { sql } from 'drizzle-orm';

export async function initializeDatabase() {
  console.log('🔄 Initializing database connection...');
  
  // Wait for dynamic imports to complete if using fallback
  if (process.env.USE_DB_FALLBACK === 'true' || process.env.NODE_ENV === 'development') {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  try {
    // Test the connection
    const result = await db.execute(sql`SELECT 1 as test`);
    
    if (result && result.length > 0) {
      const status = getDatabaseStatus ? getDatabaseStatus() : null;
      
      if (status) {
        console.log(`✅ Database connected: ${status.currentDatabase}`);
        
        if (status.isUsingLocalDb) {
          console.log('ℹ️ Using local PostgreSQL database as fallback');
          console.log('💡 This happens when Neon database is unavailable (e.g., billing issues)');
        }
      } else {
        console.log('✅ Database connected');
      }
      
      return true;
    }
    
    throw new Error('Database connection test failed');
    
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    
    // Check if it's the Neon disabled error
    if (error.message?.includes('endpoint is disabled')) {
      console.log('\n⚠️ Neon database is disabled (likely due to billing)');
      console.log('💡 The system should automatically fallback to local PostgreSQL');
      console.log('💡 If not, ensure you have PostgreSQL installed locally and run:');
      console.log('   npm run db:setup-local');
      console.log('   Then restart the server');
    }
    
    throw error;
  }
}