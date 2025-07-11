import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use postgres-js for Replit's native PostgreSQL
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

export { db, client };