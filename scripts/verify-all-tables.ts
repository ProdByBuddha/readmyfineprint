import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
});

async function verify() {
  console.log('🔍 Verifying all Q1 Roadmap tables...\n');
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%org%' OR table_name LIKE '%workspace%' OR table_name LIKE '%annotation%' OR table_name = 'activity_events')
    ORDER BY table_name;
  `;
  
  console.log('✅ Team Collaboration tables found:');
  console.log('\nOrganization Tables:');
  tables.filter(t => t.table_name.includes('org')).forEach(t => console.log(`  ✓ ${t.table_name}`));
  
  console.log('\nWorkspace Tables:');
  tables.filter(t => t.table_name.includes('workspace')).forEach(t => console.log(`  ✓ ${t.table_name}`));
  
  console.log('\nCollaboration Tables:');
  tables.filter(t => t.table_name.includes('annotation') || t.table_name === 'activity_events' || t.table_name === 'documents_to_workspaces').forEach(t => console.log(`  ✓ ${t.table_name}`));
  
  console.log(`\n📊 Total: ${tables.length} tables\n`);
  
  const indexes = await sql`
    SELECT count(*) as count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND (indexname LIKE '%org%' OR indexname LIKE '%workspace%' OR indexname LIKE '%annotation%' OR indexname LIKE '%activity%');
  `;
  
  console.log(`✅ Total indexes: ${indexes[0].count}`);
  
  await sql.end();
}

verify();
