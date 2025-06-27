import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function addSecurityQuestionsTable() {
  console.log('🔧 Adding security_questions table...');
  
  try {
    // Create security_questions table
    await db.execute(/* sql */`
      CREATE TABLE IF NOT EXISTS security_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL,
        hashed_answer TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Create index for faster lookups
    await db.execute(/* sql */`
      CREATE INDEX IF NOT EXISTS security_questions_user_id_idx 
      ON security_questions(user_id);
    `);

    // Create index for question_id lookups
    await db.execute(/* sql */`
      CREATE INDEX IF NOT EXISTS security_questions_question_id_idx 
      ON security_questions(question_id);
    `);

    console.log('✅ Security questions table created successfully');
    console.log('✅ Indexes created successfully');
    
    // Verify table exists and show structure
    const result = await db.execute(/* sql */`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'security_questions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table structure:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding security questions table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addSecurityQuestionsTable()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { addSecurityQuestionsTable };