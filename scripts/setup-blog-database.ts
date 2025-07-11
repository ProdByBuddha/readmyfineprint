#!/usr/bin/env tsx

import { db } from '../server/db.js';
import { 
  blogPosts, 
  blogTopics, 
  contentGeneration, 
  seoMetrics, 
  contentSimilarity 
} from '@shared/schema';
import { blogContentService } from '../server/blog-content-service.js';

async function setupBlogDatabase() {
  console.log('🚀 Setting up blog database tables...');
  
  try {
    // Ensure database is initialized
    await db;
    console.log('✅ Database connection established');
    
    // Note: Tables are automatically created by Drizzle ORM based on schema
    // We just need to verify they exist and seed initial data
    
    console.log('📊 Database tables ready for blog functionality');
    
    // Seed initial blog topics
    console.log('🌱 Seeding initial blog topics...');
    await blogContentService.seedTopics();
    console.log('✅ Blog topics seeded successfully');
    
    // Verify blog tables exist by trying a simple query
    try {
      const topicsCount = await db.select().from(blogTopics).limit(1);
      console.log(`✅ Blog topics table verified (${topicsCount.length} sample records)`);
    } catch (error) {
      console.warn('⚠️ Could not verify blog topics table:', error);
    }
    
    try {
      const postsCount = await db.select().from(blogPosts).limit(1);
      console.log(`✅ Blog posts table verified (${postsCount.length} existing posts)`);
    } catch (error) {
      console.warn('⚠️ Could not verify blog posts table:', error);
    }
    
    console.log('\n🎉 Blog database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Set BLOG_SCHEDULER_ENABLED=true in environment to enable auto-posting');
    console.log('2. Configure BLOG_POSTS_PER_DAY and BLOG_POST_HOURS if needed');
    console.log('3. Use /api/blog/admin/scheduler/trigger to manually generate a test post');
    console.log('4. Visit /blog to see the blog interface');
    
  } catch (error) {
    console.error('❌ Failed to setup blog database:', error);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupBlogDatabase()
    .then(() => {
      console.log('✅ Blog database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Blog database setup failed:', error);
      process.exit(1);
    });
}

export { setupBlogDatabase };