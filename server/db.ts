import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  // In development or validation mode, log the warning but don't fail immediately
  if (process.env.NODE_ENV === 'development' || process.env.VALIDATION_MODE === 'true') {
    console.warn('⚠️ DATABASE_URL not set - using fallback mode for development/validation');
  } else {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
}

// Create database connection with fallback
let client: any;
let db: any;

if (process.env.DATABASE_URL) {
  // Use postgres-js for Replit's native PostgreSQL
  client = postgres(process.env.DATABASE_URL);
  db = drizzle(client, { schema });
} else {
  // Create a mock database connection for validation mode
  console.log('🔄 Creating mock database connection for validation mode');
  client = null;
  db = {
    execute: () => Promise.resolve([]),
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    insert: () => ({ values: () => Promise.resolve() }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  };
}

export { db, client };