#!/usr/bin/env tsx
/**
 * Setup script for local PostgreSQL database
 * Creates a local database with the same schema as production
 * Run this when Neon database is disabled
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema';

const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/readmyfineprint';

console.log('🔧 Setting up local PostgreSQL database...');
console.log(`📍 Database URL: ${LOCAL_DATABASE_URL}`);

async function setupLocalDatabase() {
  try {
    // Create connection without database to create the database if needed
    const adminUrl = LOCAL_DATABASE_URL.replace('/readmyfineprint', '/postgres');
    const adminClient = postgres(adminUrl);
    const adminDb = drizzle(adminClient);
    
    console.log('📋 Creating database if not exists...');
    try {
      await adminDb.execute(sql`CREATE DATABASE readmyfineprint`);
      console.log('✅ Database created');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Database already exists');
      } else {
        throw error;
      }
    }
    
    await adminClient.end();
    
    // Now connect to the actual database
    const client = postgres(LOCAL_DATABASE_URL);
    const db = drizzle(client);
    
    console.log('🏗️ Creating tables...');
    
    // Create tables in order (respecting foreign key constraints)
    
    // 1. Users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        hashed_password TEXT,
        stripe_customer_id TEXT UNIQUE,
        email_verified BOOLEAN DEFAULT false NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_admin BOOLEAN DEFAULT false NOT NULL,
        is_deleted BOOLEAN DEFAULT false NOT NULL,
        deleted_at TIMESTAMP,
        deletion_reason TEXT,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Users table created');
    
    // 2. User subscriptions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier_id TEXT NOT NULL,
        status TEXT NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT UNIQUE,
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ User subscriptions table created');
    
    // 3. Usage records table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS usage_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
        period TEXT NOT NULL,
        documents_analyzed INTEGER DEFAULT 0 NOT NULL,
        tokens_used INTEGER DEFAULT 0 NOT NULL,
        cost DECIMAL(10, 6) DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Usage records table created');
    
    // 4. Subscription tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_token TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        device_name TEXT,
        tier_id TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN DEFAULT false NOT NULL,
        revoked_at TIMESTAMP,
        revoke_reason TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        last_used_at TIMESTAMP,
        usage_count INTEGER DEFAULT 0 NOT NULL
      )
    `);
    console.log('✅ Subscription tokens table created');
    
    // 5. Session tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS session_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT UNIQUE NOT NULL,
        encrypted_data TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Session tokens table created');
    
    // 6. Email verification codes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Email verification codes table created');
    
    // 7. Email verification rate limit table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_verification_rate_limit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        identifier TEXT NOT NULL,
        window_start TIMESTAMP NOT NULL,
        request_count INTEGER DEFAULT 0 NOT NULL
      )
    `);
    console.log('✅ Email verification rate limit table created');
    
    // 8. Email change requests table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_change_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        current_email TEXT NOT NULL,
        new_email TEXT NOT NULL,
        verification_code TEXT NOT NULL,
        security_answers_hash TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        admin_notes TEXT,
        risk_score INTEGER DEFAULT 0 NOT NULL,
        submitted_at TIMESTAMP DEFAULT now() NOT NULL,
        reviewed_at TIMESTAMP,
        reviewed_by UUID,
        expires_at TIMESTAMP NOT NULL
      )
    `);
    console.log('✅ Email change requests table created');
    
    // 9. Security questions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question1_hash TEXT NOT NULL,
        answer1_hash TEXT NOT NULL,
        question2_hash TEXT NOT NULL,
        answer2_hash TEXT NOT NULL,
        question3_hash TEXT NOT NULL,
        answer3_hash TEXT NOT NULL,
        setup_at TIMESTAMP DEFAULT now() NOT NULL,
        last_verified_at TIMESTAMP
      )
    `);
    console.log('✅ Security questions table created');
    
    // 10. Consent records table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consent_records (
        id TEXT PRIMARY KEY,
        user_pseudonym TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        user_agent_hash TEXT NOT NULL,
        consent_timestamp TIMESTAMP NOT NULL,
        consent_version TEXT NOT NULL,
        purposes_accepted TEXT[] NOT NULL,
        purposes_rejected TEXT[],
        gpc_signal BOOLEAN,
        dnta_signal BOOLEAN,
        jurisdiction TEXT,
        browser_privacy_config JSONB,
        consent_flow_type TEXT,
        withdraw_timestamp TIMESTAMP,
        withdraw_reason TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ Consent records table created');
    
    // Create indexes for better performance
    console.log('📇 Creating indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_subscription_tokens_user_id ON subscription_tokens(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_subscription_tokens_device_fingerprint ON subscription_tokens(device_fingerprint)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email ON email_verification_codes(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_id ON email_change_requests(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_email_change_requests_status ON email_change_requests(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_consent_records_user_pseudonym ON consent_records(user_pseudonym)`);
    
    console.log('✅ All indexes created');
    
    // Create collective free tier user if not exists
    console.log('👥 Creating collective free tier user...');
    
    const collectiveUserId = '00000000-0000-0000-0000-000000000001';
    
    try {
      await db.execute(sql`
        INSERT INTO users (id, email, email_verified, is_active, is_admin)
        VALUES (${collectiveUserId}, 'collective@system.internal', true, true, false)
        ON CONFLICT (id) DO NOTHING
      `);
      
      await db.execute(sql`
        INSERT INTO user_subscriptions (user_id, tier_id, status, current_period_start, current_period_end)
        VALUES (
          ${collectiveUserId},
          'free',
          'active',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + INTERVAL '100 years'
        )
        ON CONFLICT DO NOTHING
      `);
      
      console.log('✅ Collective free tier user created');
    } catch (error) {
      console.log('ℹ️ Collective user might already exist');
    }
    
    // Test the connection
    const testResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    console.log(`✅ Database setup complete! User count: ${testResult[0].count}`);
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Error setting up local database:', error);
    process.exit(1);
  }
}

// Run the setup
setupLocalDatabase().then(() => {
  console.log('🎉 Local database is ready for use!');
  console.log('📌 To use it, set DATABASE_URL to:', LOCAL_DATABASE_URL);
  process.exit(0);
});