import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
});

async function verify() {
  console.log('🔍 Verifying organization tables...\n');
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%org%'
    ORDER BY table_name;
  `;
  
  console.log('✅ Organization tables found:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));
  
  console.log('\n🔍 Checking indexes...');
  const indexes = await sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE '%org%'
    ORDER BY indexname;
  `;
  
  console.log(`\n✅ Found ${indexes.length} organization-related indexes`);
  
  await sql.end();
}

verify();
