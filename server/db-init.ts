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
      console.log('✅ Database connected to Replit PostgreSQL');
      return true;
    }
    
    throw new Error('Database connection test failed');
    
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    
    // Check if it's a connection error
    if (error.message?.includes('connection') || error.message?.includes('socket') || error.message?.includes('timeout')) {
      console.log('\n⚠️ Unable to connect to PostgreSQL database');
      console.log('💡 This may be due to network issues or database unavailability');
      console.log('🔄 The app will continue in development mode using fallback storage');
    }
    
    throw error;
  }
}