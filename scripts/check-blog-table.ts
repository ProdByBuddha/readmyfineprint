import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL);

async function checkBlogTable() {
  try {
    console.log('🔍 Checking blog_posts table structure...');
    
    // Check if table exists
    const tableExists = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'blog_posts'
    `;
    
    if (tableExists.length === 0) {
      console.log('❌ blog_posts table does not exist');
      return;
    }
    
    console.log('✅ blog_posts table exists');
    
    // Get all columns
    const columns = await client`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'blog_posts'
      ORDER BY ordinal_position
    `;
    
    console.log('📋 Table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.column_default ? ` (default: ${col.column_default})` : ''}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
    
    // Check for artificial_view_count specifically
    const artificialViewColumn = columns.find(col => col.column_name === 'artificial_view_count');
    if (artificialViewColumn) {
      console.log('✅ artificial_view_count column found:', artificialViewColumn);
    } else {
      console.log('❌ artificial_view_count column NOT found');
    }
    
    // Try to count rows
    const rowCount = await client`SELECT COUNT(*) as count FROM blog_posts`;
    console.log(`📊 Total rows in blog_posts: ${rowCount[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking table:', error);
    throw error;
  } finally {
    await client.end();
  }
}

checkBlogTable().catch((error) => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});