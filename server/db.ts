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
let initializationPromise: Promise<void> | null = null;

async function initializeDatabase() {
  if (USE_DB_FALLBACK) {
    // Use the fallback database system that automatically switches between Neon and local PostgreSQL
    console.log('🔄 Database fallback mode enabled - will use local PostgreSQL if Neon is unavailable');
    
    // Import the fallback system
    const fallbackModule = await import('./db-with-fallback');
    db = fallbackModule.db;
    getDatabaseStatus = fallbackModule.getDatabaseStatus;
    
    // Initialize the database connection
    await fallbackModule.initializeDatabase();
    console.log('✅ Database fallback system initialized');
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
}

// Initialize database on import
initializationPromise = initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Ensure database is initialized before use
export async function ensureDbInitialized() {
  if (initializationPromise) {
    await initializationPromise;
    initializationPromise = null;
  }
}

// Export everything
export { db, pool, getDatabaseStatus };