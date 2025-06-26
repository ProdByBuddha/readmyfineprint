import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { Pool, neonConfig } from "@neondatabase/serverless";
import postgres from "postgres";
import ws from "ws";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

// Configure Neon
neonConfig.webSocketConstructor = ws;

// Database connection state
let currentDb: any = null;
let isUsingLocalDb = false;
let lastHealthCheckTime = 0;
let neonIsDisabled = false;

const HEALTH_CHECK_INTERVAL = 60000; // Check every minute
const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/readmyfineprint';

/**
 * Create a health check for the database
 */
async function checkDatabaseHealth(db: any): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT 1 as health_check`);
    return result && result.length > 0;
  } catch (error: any) {
    console.error('Database health check failed:', error.message);
    
    // Check if it's a "endpoint is disabled" error
    if (error.message?.includes('endpoint is disabled') || error.code === 'XX000') {
      neonIsDisabled = true;
    }
    
    return false;
  }
}

/**
 * Initialize Neon database connection
 */
function initializeNeonDb() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set, skipping Neon initialization');
      return null;
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle({ client: pool, schema });
  } catch (error) {
    console.error('Failed to initialize Neon database:', error);
    return null;
  }
}

/**
 * Initialize local PostgreSQL database connection
 */
function initializeLocalDb() {
  try {
    console.log('🔄 Attempting to connect to local PostgreSQL...');
    const pgClient = postgres(LOCAL_DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    const db = drizzlePg(pgClient, { schema });
    console.log('✅ Connected to local PostgreSQL database');
    return { db, client: pgClient };
  } catch (error) {
    console.error('Failed to initialize local PostgreSQL:', error);
    return null;
  }
}

/**
 * Get database connection with automatic fallback
 */
export async function getDbWithFallback() {
  const now = Date.now();
  
  // If we already have a working connection and haven't checked in a while
  if (currentDb && (now - lastHealthCheckTime < HEALTH_CHECK_INTERVAL)) {
    return currentDb;
  }
  
  // Time for a health check or initial connection
  lastHealthCheckTime = now;
  
  // If we know Neon is disabled, skip trying it
  if (!neonIsDisabled && !isUsingLocalDb) {
    // Try Neon first
    const neonDb = initializeNeonDb();
    if (neonDb) {
      const isHealthy = await checkDatabaseHealth(neonDb);
      if (isHealthy) {
        currentDb = neonDb;
        isUsingLocalDb = false;
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Using Neon database');
        }
        return currentDb;
      } else {
        console.warn('⚠️ Neon database health check failed, switching to local fallback...');
      }
    }
  }
  
  // Fallback to local PostgreSQL
  if (!isUsingLocalDb || !currentDb) {
    const localResult = initializeLocalDb();
    if (localResult) {
      const isHealthy = await checkDatabaseHealth(localResult.db);
      if (isHealthy) {
        currentDb = localResult.db;
        isUsingLocalDb = true;
        
        console.log('🔄 Switched to local PostgreSQL database');
        console.log('ℹ️ To set up local database, run: npm run db:setup-local');
        
        // Periodically try to reconnect to Neon
        if (!neonIsDisabled) {
          setTimeout(async () => {
            neonIsDisabled = false; // Reset flag to retry
            console.log('🔄 Attempting to reconnect to Neon database...');
            await getDbWithFallback();
          }, 5 * 60 * 1000); // Retry every 5 minutes
        }
        
        return currentDb;
      } else {
        throw new Error('Both Neon and local PostgreSQL databases are unavailable');
      }
    }
  }
  
  if (!currentDb) {
    throw new Error('No database connection available');
  }
  
  return currentDb;
}

/**
 * Export a db object that uses the fallback mechanism
 * This replaces the original db export
 */
export const db = new Proxy({} as any, {
  get: (_target, prop) => {
    return async (...args: any[]) => {
      const database = await getDbWithFallback();
      return database[prop](...args);
    };
  }
});

/**
 * Get current database status
 */
export function getDatabaseStatus() {
  return {
    isUsingLocalDb,
    neonIsDisabled,
    currentDatabase: isUsingLocalDb ? 'PostgreSQL (Local)' : 'Neon (Cloud)',
    localDatabaseUrl: LOCAL_DATABASE_URL,
  };
}