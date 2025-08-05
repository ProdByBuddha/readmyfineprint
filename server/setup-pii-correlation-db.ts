#!/usr/bin/env tsx
/**
 * Setup script for PII Correlation Database
 * Initializes PostgreSQL tables for PII correlation tracking
 */

import { PostgreSQLPIIStorage } from './postgresql-pii-storage';
import { getDatabaseConfig } from './database-config';

async function setupPIICorrelationDatabase() {
  console.log('🔧 Setting up PII Correlation Database...');
  
  try {
    const config = getDatabaseConfig();
    
    if (config.type !== 'postgresql') {
      console.log('ℹ️ Non-PostgreSQL configuration detected. Skipping database setup.');
      return;
    }

    // Initialize PostgreSQL storage
    const storage = new PostgreSQLPIIStorage(config.postgresql);
    
    // Explicitly initialize database tables
    console.log('🏗️ Creating database tables...');
    await storage.initialize();
    
    // Test the connection and table creation
    console.log('📊 Testing database connection...');
    
    // Try a simple query to verify everything is working
    const analytics = await storage.getCorrelationAnalytics();
    console.log('✅ Database connection successful!');
    console.log(`📈 Current stats: ${analytics.totalSessions} sessions, ${analytics.totalDocuments} documents`);
    
    // Run maintenance to clean up any expired records
    console.log('🧹 Running maintenance cleanup...');
    const cleanedCount = await storage.runMaintenance();
    console.log(`🗑️ Cleaned up ${cleanedCount} expired records`);
    
    await storage.disconnect();
    
    console.log('✅ PII Correlation Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to setup PII Correlation Database:', error);
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupPIICorrelationDatabase();
}

export { setupPIICorrelationDatabase };