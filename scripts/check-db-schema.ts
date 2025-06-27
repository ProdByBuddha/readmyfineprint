/**
 * Check Database Schema
 * Verify that session_tokens table exists
 */

import { db } from '../server/db';

async function checkSchema() {
  try {
    console.log('Checking database schema...\n');
    
    // Check if session_tokens table exists
    const result = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'session_tokens'
      );
    `);
    
    console.log('session_tokens table exists:', result.rows[0]?.exists);
    
    // If it exists, check the schema
    if (result.rows[0]?.exists) {
      const columns = await db.execute(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'session_tokens'
        ORDER BY ordinal_position;
      `);
      
      console.log('\nTable columns:');
      columns.rows.forEach((col: any) => {
        console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
  } catch (error) {
    console.error('Database check failed:', error);
  }
}

checkSchema(); 