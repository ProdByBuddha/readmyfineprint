/**
 * Migration Script: Create email_change_requests table
 * Adds the missing email_change_requests table to the database
 */
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createEmailChangeRequestsTable() {
  console.log('🔄 Creating email_change_requests table...');
  
  try {
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
    console.log('✅ email_change_requests table created');

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_id 
        ON email_change_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_status 
        ON email_change_requests(status);
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_expires_at 
        ON email_change_requests(expires_at);
      CREATE INDEX IF NOT EXISTS idx_email_change_requests_created_at 
        ON email_change_requests(created_at);
    `);
    console.log('✅ email_change_requests indexes created');

    // Create trigger for auto-updating updated_at column
    await pool.query(`
      CREATE TRIGGER update_email_change_requests_updated_at 
        BEFORE UPDATE ON email_change_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ email_change_requests trigger created');

    console.log('🎉 email_change_requests table setup completed successfully!');

  } catch (error) {
    console.error('❌ Failed to create email_change_requests table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createEmailChangeRequestsTable();