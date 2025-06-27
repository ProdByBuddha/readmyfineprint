#!/usr/bin/env tsx
/**
 * Set up the database schema for local PostgreSQL
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../shared/schema";
import { sql } from "drizzle-orm";

const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/readmyfineprint';

async function setupDatabase() {
  console.log("🔧 Database Setup Tool\n");
  
  try {
    // Connect to PostgreSQL
    console.log("📦 Connecting to PostgreSQL...");
    const pgClient = postgres(LOCAL_DATABASE_URL, {
      max: 1,
    });
    
    const db = drizzle(pgClient, { schema });
    
    // Test connection
    console.log("🔍 Testing database connection...");
    await db.execute(sql`SELECT 1`);
    console.log("✅ Database connection successful");
    
    // Create tables based on schema
    console.log("\n📋 Creating database tables...");
    
    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        subscription_status TEXT DEFAULT 'free',
        subscription_tier TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        subscription_current_period_end TIMESTAMP,
        trial_ends_at TIMESTAMP,
        totp_secret TEXT,
        totp_enabled BOOLEAN DEFAULT false,
        security_questions JSONB,
        failed_login_attempts INTEGER DEFAULT 0,
        account_locked_until TIMESTAMP,
        deletion_requested_at TIMESTAMP,
        deletion_scheduled_for TIMESTAMP
      )
    `);
    console.log("✅ Created users table");
    
    // Create documents table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        content TEXT NOT NULL,
        analysis JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created documents table");
    
    // Create subscriptions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        stripe_subscription_id TEXT UNIQUE,
        stripe_customer_id TEXT,
        status TEXT NOT NULL,
        tier TEXT NOT NULL,
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        cancel_at_period_end BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created subscriptions table");
    
    // Create usage_records table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS usage_records (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created usage_records table");
    
    // Create email_change_requests table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_change_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        current_email TEXT NOT NULL,
        new_email TEXT NOT NULL,
        verification_token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        requested_by TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT
      )
    `);
    console.log("✅ Created email_change_requests table");
    
    // Create consent_logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consent_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        email TEXT,
        consent_type TEXT NOT NULL,
        consent_given BOOLEAN NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        consent_text TEXT,
        version TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created consent_logs table");
    
    // Create security_logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        user_id TEXT,
        email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        details JSONB,
        event_category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created security_logs table");
    
    // Create sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created sessions table");
    
    // Create indexes
    console.log("\n🔍 Creating indexes...");
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    console.log("✅ Created indexes");
    
    console.log("\n✨ Database setup completed successfully!");
    console.log("💡 You can now start the application with: npm run dev");
    
    // Close connection
    await pgClient.end();
    
  } catch (error) {
    console.error("\n❌ Database setup failed:", error);
    console.error("\n🔧 Troubleshooting tips:");
    console.error("1. Ensure PostgreSQL is running");
    console.error("2. Create the database: createdb readmyfineprint");
    console.error("3. Check your LOCAL_DATABASE_URL in .env");
    console.error("4. Verify PostgreSQL credentials");
    process.exit(1);
  }
}

// Run setup
setupDatabase();