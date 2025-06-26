import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon
neonConfig.webSocketConstructor = ws;

// Check if we should use the fallback database system
const USE_DB_FALLBACK = process.env.USE_DB_FALLBACK === 'true' || process.env.NODE_ENV === 'development';

// This will be set after initialization
let db: any;
let pool: Pool | null = null;
let getDatabaseStatus: any;

if (USE_DB_FALLBACK) {
  // Use the fallback database system that automatically switches between Neon and local PostgreSQL
  console.log('🔄 Database fallback mode enabled - will use local PostgreSQL if Neon is unavailable');
  
  // Dynamically import and use the fallback system
  import('./db-with-fallback').then(fallbackModule => {
    db = fallbackModule.db;
    getDatabaseStatus = fallbackModule.getDatabaseStatus;
    console.log('✅ Database fallback system initialized');
  }).catch(error => {
    console.error('Failed to initialize database fallback system:', error);
    process.exit(1);
  });
} else {
  // Original Neon-only configuration
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
  getDatabaseStatus = () => ({
    isUsingLocalDb: false,
    neonIsDisabled: false,
    currentDatabase: 'Neon (Cloud)',
    localDatabaseUrl: 'N/A',
  });
}

// Export everything
export { db, pool, getDatabaseStatus };