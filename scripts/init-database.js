/**
 * Database Initialization Script
 * Creates tables for user and subscription management
 */
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initializeDatabase() {
  console.log('🔄 Initializing database for user and subscription management...');
  
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE,
        hashed_password TEXT,
        stripe_customer_id TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Users table created');

    // Create user_subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        tier_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT UNIQUE,
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ User subscriptions table created');

    // Create usage_records table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
        period TEXT NOT NULL,
        documents_analyzed INTEGER DEFAULT 0 NOT NULL,
        tokens_used INTEGER DEFAULT 0 NOT NULL,
        cost DECIMAL(10,6) DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Usage records table created');

    // Create email_change_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_change_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        current_email TEXT NOT NULL,
        new_email TEXT NOT NULL,
        reason TEXT NOT NULL,
        client_ip TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        security_answers TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        verification_code TEXT,
        attempts INTEGER DEFAULT 0 NOT NULL,
        max_attempts INTEGER DEFAULT 3 NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT email_change_requests_status_check 
          CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
      );
    `);
    console.log('✅ Email change requests table created');

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON user_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);
      CREATE INDEX IF NOT EXISTS idx_usage_user_period ON usage_records(user_id, period);
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_id ON email_change_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_status ON email_change_requests(status);
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_expires_at ON email_change_requests(expires_at);
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_created_at ON email_change_requests(created_at);
    `);
    console.log('✅ Database indexes created');

    // Create updated_at trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers for auto-updating updated_at columns
    await pool.query(`
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_usage_updated_at BEFORE UPDATE ON usage_records
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_email_change_requests_updated_at BEFORE UPDATE ON email_change_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Database triggers created');

    console.log('🎉 Database initialization completed successfully!');
    
    // Insert sample user for testing (optional)
    const sampleUser = await pool.query(`
      INSERT INTO users (email, username) 
      VALUES ('demo@example.com', 'demo') 
      ON CONFLICT (email) DO NOTHING
      RETURNING id;
    `);
    
    if (sampleUser.rows.length > 0) {
      console.log('📝 Sample user created for testing');
    }

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();