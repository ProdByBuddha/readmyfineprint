/**
 * Database Migration: Add User Preferences Table
 * Adds table for storing user preferences (theme, legal acceptance, cookie consent, etc.)
 */

import { db } from '../server/db';

async function addUserPreferencesTable() {
  console.log('🔄 Starting user preferences table migration...');

  try {
    // Check if database connection is available
    if (!db) {
      console.error('❌ Database connection not available');
      process.exit(1);
    }
    
    console.log('📊 Creating user preferences table...');

    // Create User Preferences table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        preference_key TEXT NOT NULL,
        preference_value JSONB NOT NULL,
        preference_type TEXT NOT NULL DEFAULT 'user',
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(user_id, preference_key)
      );
    `);

    console.log('✅ User preferences table created successfully');

    // Create indexes for better performance
    console.log('📈 Creating indexes for user preferences...');

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
      ON user_preferences(user_id);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_preferences_key 
      ON user_preferences(preference_key);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_preferences_type 
      ON user_preferences(preference_type);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_preferences_expires 
      ON user_preferences(expires_at) WHERE expires_at IS NOT NULL;
    `);

    console.log('✅ Indexes created successfully');

    // Create trigger for updating updated_at timestamp
    console.log('🔧 Creating update trigger...');

    await db.execute(`
      CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await db.execute(`
      DROP TRIGGER IF EXISTS trigger_update_user_preferences_updated_at ON user_preferences;
      CREATE TRIGGER trigger_update_user_preferences_updated_at
        BEFORE UPDATE ON user_preferences
        FOR EACH ROW
        EXECUTE FUNCTION update_user_preferences_updated_at();
    `);

    console.log('✅ Update trigger created successfully');

    // Insert default preference types for documentation
    console.log('📝 Inserting preference type documentation...');

    await db.execute(`
      INSERT INTO user_preferences (user_id, preference_key, preference_value, preference_type)
      VALUES 
        ('00000000-0000-0000-0000-000000000000', '_schema_version', '{"version": "1.0.0", "description": "User preferences schema version"}', 'system'),
        ('00000000-0000-0000-0000-000000000000', '_preference_types', '{
          "theme": {"type": "string", "values": ["light", "dark", "system"], "description": "User interface theme preference"},
          "legal_disclaimer_accepted": {"type": "boolean", "description": "Legal disclaimer acceptance status"},
          "cookie_consent": {"type": "object", "description": "Cookie consent preferences with granular settings"},
          "donation_page_visited": {"type": "boolean", "description": "Whether user has visited donation page"},
          "device_fingerprint_backup": {"type": "string", "description": "Backup of device fingerprint for cross-device consistency"}
        }', 'system')
      ON CONFLICT (user_id, preference_key) DO NOTHING;
    `);

    console.log('✅ User preferences table migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during user preferences table migration:', error);
    throw error;
  }
}

// Auto-run the migration
addUserPreferencesTable()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });

export { addUserPreferencesTable }; 