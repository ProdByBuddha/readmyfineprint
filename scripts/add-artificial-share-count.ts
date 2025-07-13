import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL);

async function addArtificialShareCountColumn() {
  try {
    console.log('🔧 Adding artificial_share_count column to blog_posts table...');
    
    // Check if column already exists
    const columnExists = await client`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'blog_posts' 
      AND column_name = 'artificial_share_count'
    `;
    
    if (columnExists.length > 0) {
      console.log('✅ Column artificial_share_count already exists');
      return;
    }
    
    // Add the column
    await client`
      ALTER TABLE blog_posts 
      ADD COLUMN artificial_share_count INTEGER DEFAULT 0
    `;
    
    console.log('✅ Successfully added artificial_share_count column');
    
    // Verify the column was added
    const verifyColumn = await client`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'blog_posts' 
      AND column_name = 'artificial_share_count'
    `;
    
    if (verifyColumn.length > 0) {
      console.log('✅ Column verification successful:', verifyColumn[0]);
    }
    
  } catch (error) {
    console.error('❌ Error adding artificial_share_count column:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
addArtificialShareCountColumn()
  .then(() => {
    console.log('🎉 Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 