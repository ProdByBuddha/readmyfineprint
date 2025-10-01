/**
 * Database Migration: Add Organization and Team Collaboration Tables
 * Phase 1: Organization Core and Invitations
 * 
 * This migration adds:
 * - organizations
 * - organization_users
 * - organization_invitations
 * - org_usage_daily
 * - org_api_keys
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
});

async function migrate() {
  console.log('🚀 Starting Organization Tables Migration...\n');

  try {
    // Create enum types first
    console.log('Creating enum types...');
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE org_role AS ENUM ('admin', 'member', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE org_user_status AS ENUM ('active', 'invited', 'suspended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    console.log('✅ Enum types created\n');

    // Create organizations table
    console.log('Creating organizations table...');
    await sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        billing_tier TEXT NOT NULL DEFAULT 'business',
        stripe_customer_id TEXT UNIQUE,
        stripe_subscription_id TEXT UNIQUE,
        seat_limit INTEGER,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP,
        CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
        CONSTRAINT valid_seat_limit CHECK (seat_limit IS NULL OR seat_limit > 0)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by_user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;`;

    console.log('✅ Organizations table created\n');

    // Create organization_users table
    console.log('Creating organization_users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS organization_users (
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        role org_role NOT NULL DEFAULT 'member',
        status org_user_status NOT NULL DEFAULT 'active',
        invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        joined_at TIMESTAMP,
        last_seen_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_id, user_id)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_org_users_user_id ON organization_users(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_users_role ON organization_users(org_id, role);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_users_status ON organization_users(org_id, status);`;

    console.log('✅ Organization_users table created\n');

    // Create organization_invitations table
    console.log('Creating organization_invitations table...');
    await sql`
      CREATE TABLE IF NOT EXISTS organization_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role org_role NOT NULL DEFAULT 'member',
        inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        token_prefix TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
        CONSTRAINT valid_expiry CHECK (expires_at > created_at)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(org_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_invitations_token_hash ON organization_invitations(token_hash);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_invitations_token_prefix ON organization_invitations(token_prefix);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_invitations_pending ON organization_invitations(org_id, expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;`;

    console.log('✅ Organization_invitations table created\n');

    // Create org_usage_daily table
    console.log('Creating org_usage_daily table...');
    await sql`
      CREATE TABLE IF NOT EXISTS org_usage_daily (
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        analyses_count INTEGER NOT NULL DEFAULT 0,
        annotations_count INTEGER NOT NULL DEFAULT 0,
        api_calls_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (org_id, date),
        CONSTRAINT valid_counts CHECK (
          tokens_used >= 0 AND 
          analyses_count >= 0 AND 
          annotations_count >= 0 AND 
          api_calls_count >= 0
        )
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_org_usage_date ON org_usage_daily(date DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_usage_org_date ON org_usage_daily(org_id, date DESC);`;

    console.log('✅ Org_usage_daily table created\n');

    // Create org_api_keys table
    console.log('Creating org_api_keys table...');
    await sql`
      CREATE TABLE IF NOT EXISTS org_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        prefix TEXT NOT NULL,
        scopes JSONB NOT NULL DEFAULT '["documents.read"]'::jsonb,
        rate_limit_override INTEGER,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMP,
        CONSTRAINT valid_rate_limit CHECK (rate_limit_override IS NULL OR rate_limit_override > 0),
        CONSTRAINT valid_name CHECK (length(name) >= 1 AND length(name) <= 100)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_org_api_keys_org_id ON org_api_keys(org_id) WHERE revoked_at IS NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_api_keys_prefix ON org_api_keys(prefix);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_org_api_keys_key_hash ON org_api_keys(key_hash) WHERE revoked_at IS NULL;`;

    console.log('✅ Org_api_keys table created\n');

    // Add default_org_id to users table
    console.log('Adding default_org_id to users table...');
    await sql`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN default_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_users_default_org ON users(default_org_id) WHERE default_org_id IS NOT NULL;`;

    console.log('✅ Default_org_id column added to users\n');

    // Create a function to auto-update updated_at timestamp
    console.log('Creating updated_at trigger function...');
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;

    await sql`DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;`;
    
    await sql`
      CREATE TRIGGER update_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    console.log('✅ Triggers created\n');

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - organizations table');
    console.log('  - organization_users table');
    console.log('  - organization_invitations table');
    console.log('  - org_usage_daily table');
    console.log('  - org_api_keys table');
    console.log('  - Added default_org_id to users table');
    console.log('\n🎉 Database is ready for Team Collaboration features!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run migration
migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
