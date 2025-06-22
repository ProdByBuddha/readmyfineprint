
import { Pool, neonConfig } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import ws from 'ws';

// Configure WebSocket for Node.js environment
neonConfig.webSocketConstructor = ws;

// Load environment variables
config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createFreeTierUser() {
  console.log('🔄 Creating free tier user in database...');
  
  try {
    // Use a deterministic UUID for the collective free tier user
    const collectiveUserId = '00000000-0000-0000-0000-000000000001';
    
    // Check if collective user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [collectiveUserId]
    );

    if (existingUser.rows.length > 0) {
      console.log('✅ Free tier user already exists in database');
      return;
    }

    // Create the collective free tier user
    const result = await pool.query(`
      INSERT INTO users (
        id,
        email,
        username,
        hashed_password,
        stripe_customer_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, email, username
    `, [
      collectiveUserId,
      'collective.free.tier@internal.system',
      'collective_free_tier',
      null, // No password for system user
      null  // No Stripe customer ID
    ]);

    console.log('✅ Created collective free tier user for usage tracking');
    console.log(`   User ID: ${result.rows[0].id}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Username: ${result.rows[0].username}`);

    // Create a free tier subscription record for this user
    const subscriptionResult = await pool.query(`
      INSERT INTO user_subscriptions (
        id,
        user_id,
        tier_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '1000 years', FALSE, NOW(), NOW())
      RETURNING id, tier_id, status
    `, [
      uuidv4(),
      collectiveUserId,
      'free',
      'active'
    ]);

    console.log('✅ Created free tier subscription record');
    console.log(`   Subscription ID: ${subscriptionResult.rows[0].id}`);
    console.log(`   Tier: ${subscriptionResult.rows[0].tier_id}`);
    console.log(`   Status: ${subscriptionResult.rows[0].status}`);

  } catch (error) {
    console.error('❌ Error creating free tier user:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
createFreeTierUser()
  .then(() => {
    console.log('🎉 Free tier user creation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
