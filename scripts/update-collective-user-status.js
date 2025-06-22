
import { Pool, neonConfig } from '@neondatabase/serverless';
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

async function updateCollectiveUserStatus() {
  console.log('🔄 Updating collective free tier user status...');
  
  try {
    const collectiveUserId = '00000000-0000-0000-0000-000000000001';
    
    // Update the subscription status from 'active' to 'free_tier'
    const result = await pool.query(`
      UPDATE user_subscriptions 
      SET status = 'free_tier', updated_at = NOW()
      WHERE user_id = $1 AND tier_id = 'free'
      RETURNING id, status
    `, [collectiveUserId]);

    if (result.rows.length > 0) {
      console.log('✅ Updated collective free tier user subscription status');
      console.log(`   Subscription ID: ${result.rows[0].id}`);
      console.log(`   New Status: ${result.rows[0].status}`);
    } else {
      console.log('ℹ️ No collective free tier user found to update');
    }

  } catch (error) {
    console.error('❌ Error updating collective user status:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
updateCollectiveUserStatus()
  .then(() => {
    console.log('🎉 Status update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
