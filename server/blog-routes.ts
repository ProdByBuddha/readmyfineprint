The change updates the description of the admin endpoints for blog posts to indicate a JWT fallback for authentication.
```
```replit_final_file
import { Router } from 'express';
import { db } from './db.js';
import { 
  blogPosts, 
  blogTopics, 
  contentGeneration, 
  contentSimilarity,
  seoMetrics,
  blogPostSchema,
  blogTopicSchema,
  BlogPost,
  BlogTopic
} from '@shared/schema';
import { eq, desc, asc, and, ilike, isNotNull, gte, or, count, sql } from 'drizzle-orm';
import { blogContentService } from './blog-content-service.js';
import { blogScheduler } from './blog-scheduler.js';
import { requireAdminAuth, requireAdminViaSubscription } from './auth.js';

const router = Router();

// Public routes
// Get all published blog posts with pagination
router.get('/posts', async (req, res) => {
  try {
    // Use real database for blog posts

    await db;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;
    const search = req.query.search as string;
    const featured = req.query.featured === 'true';

    const offset = (page - 1) * limit;

    let whereConditions = and(
      eq(blogPosts.status, 'published'),
      eq(blogPosts.isActive, true),
      isNotNull(blogPosts.publishedAt)
    );

    if (category) {
      whereConditions = and(whereConditions, eq(blogPosts.category, category));
    }

    if (featured) {
      whereConditions = and(whereConditions, eq(blogPosts.isFeatured, true));
    }

    if (search) {
      whereConditions = and(
        whereConditions,
        or(
          ilike(blogPosts.title, `%${search}%`),
          ilike(blogPosts.excerpt, `%${search}%`),
          ilike(blogPosts.keywords, `%${search}%`)
        )
      );
    }

    const posts = await db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        excerpt: blogPosts.excerpt,
        category: blogPosts.category,
        tags: blogPosts.tags,
        publishedAt: blogPosts.publishedAt,
        readingTime: blogPosts.readingTime,
        viewCount: blogPosts.viewCount,
        artificialViewCount: blogPosts.artificialViewCount,
        shareCount: blogPosts.shareCount,
        artificialShareCount: blogPosts.artificialShareCount,
        isFeatured: blogPosts.isFeatured,
        metaDescription: blogPosts.metaDescription,
        keywords: blogPosts.keywords,
      })
      .from(blogPosts)
      .where(whereConditions)
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);

    // Add displayViewCount and displayShareCount to each post
    const postsWithDisplayCounts = posts.map((post: any) => ({
      ...post,
      displayViewCount: (post.viewCount || 0) + (post.artificialViewCount || 0),
      displayShareCount: (post.shareCount || 0) + (post.artificialShareCount || 0)
    }));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: blogPosts.id })
      .from(blogPosts)
      .where(whereConditions);

    const total = totalResult.length;
    const totalPages = Math.ceil(total / limit);

    res.json({
      posts: postsWithDisplayCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// Get single blog post by slug
router.get('/posts/:slug', async (req, res) => {
  try {
    // Use real database for blog posts

    await db;

    const { slug } = req.params;

    const [post] = await db
      .select()
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.slug, slug),
          eq(blogPosts.status, 'published'),
          eq(blogPosts.isActive, true)
        )
      )
      .limit(1);

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    // Increment view count
    await db
      .update(blogPosts)
      .set({ viewCount: (post.viewCount || 0) + 1 })
      .where(eq(blogPosts.id, post.id));

    // Get related posts
    const relatedPosts = await db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        excerpt: blogPosts.excerpt,
        publishedAt: blogPosts.publishedAt,
        readingTime: blogPosts.readingTime,
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.category, post.category),
          eq(blogPosts.status, 'published'),
          eq(blogPosts.isActive, true),
          // ne(blogPosts.id, post.id) // Exclude current post
        )
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(3);

    const filteredRelated = relatedPosts.filter((p: any) => p.id !== post.id);

    res.json({
      post: {
        ...post,
        viewCount: (post.viewCount || 0) + 1,
        displayViewCount: (post.viewCount || 0) + 1 + (post.artificialViewCount || 0),
        displayShareCount: (post.shareCount || 0) + (post.artificialShareCount || 0),
      },
      relatedPosts: filteredRelated,
    });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
});

// Get blog categories
router.get('/categories', async (req, res) => {
  try {
    // Use real database for categories

    await db;

    const categories = await db
      .select({
        category: blogPosts.category,
        count: count(blogPosts.id),
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.status, 'published'),
          eq(blogPosts.isActive, true)
        )
      )
      .groupBy(blogPosts.category)
      .orderBy(asc(blogPosts.category));

    const formattedCategories = categories.map((cat: any) => ({
      name: cat.category,
      count: cat.count,
      slug: cat.category.toLowerCase().replace(/\s+/g, '-'),
    }));

    res.json({ categories: formattedCategories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get blog sitemap data
router.get('/sitemap', async (req, res) => {
  try {
    await db;

    const posts = await db
      .select({
        slug: blogPosts.slug,
        updatedAt: blogPosts.updatedAt,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.status, 'published'),
          eq(blogPosts.isActive, true)
        )
      )
      .orderBy(desc(blogPosts.publishedAt));

    res.json({ posts });
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    res.status(500).json({ error: 'Failed to fetch sitemap' });
  }
});

// Admin routes
// Get all posts (including drafts) - Admin only
router.get('/admin/posts', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const offset = (page - 1) * limit;

    let whereConditions: any = eq(blogPosts.isActive, true);

    if (status) {
      whereConditions = and(whereConditions, eq(blogPosts.status, status));
    }

    const posts = await db
      .select()
      .from(blogPosts)
      .where(whereConditions)
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: blogPosts.id })
      .from(blogPosts)
      .where(whereConditions);

    const total = totalResult.length;
    const totalPages = Math.ceil(total / limit);

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching admin posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Create new blog post manually - Admin only
router.post('/admin/posts', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const validatedData = blogPostSchema.parse(req.body);

    const slug = validatedData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    // Check if slug exists
    const existingPost = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);

    const finalSlug = existingPost.length > 0 ? `${slug}-${Date.now()}` : slug;

    const wordCount = validatedData.content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    const [newPost] = await db
      .insert(blogPosts)
      .values({
        ...validatedData,
        slug: finalSlug,
        wordCount,
        readingTime,
        publishedAt: validatedData.status === 'published' ? new Date() : null,
      })
      .returning();

    res.status(201).json({ post: newPost });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

// Update blog post - Admin only
router.put('/admin/posts/:id', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const { id } = req.params;
    const validatedData = blogPostSchema.partial().parse(req.body);

    const updateData: any = {
      ...validatedData,
      updatedAt: new Date(),
    };

    if (validatedData.content) {
      const wordCount = validatedData.content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
      updateData.wordCount = wordCount;
      updateData.readingTime = Math.ceil(wordCount / 200);
    }

    if (validatedData.status === 'published' && !updateData.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const [updatedPost] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, id))
      .returning();

    if (!updatedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post: updatedPost });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// Delete blog post - Admin only (soft delete by default)
router.delete('/admin/posts/:id', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      // Hard delete - permanently remove from database
      console.log(`🗑️ Performing hard delete of blog post: ${id}`);

      // Delete related records first
      await db.delete(contentSimilarity).where(
        or(
          eq(contentSimilarity.postId1, id),
          eq(contentSimilarity.postId2, id)
        )
      );

      await db.delete(contentGeneration).where(eq(contentGeneration.postId, id));

      // Delete the post itself
      const [deletedPost] = await db
        .delete(blogPosts)
        .where(eq(blogPosts.id, id))
        .returning();

      if (!deletedPost) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json({ 
        message: 'Post permanently deleted',
        deleted: deletedPost,
        permanent: true
      });
    } else {
      // Soft delete - mark as inactive
      console.log(`🗃️ Performing soft delete of blog post: ${id}`);

      const [deletedPost] = await db
        .update(blogPosts)
        .set({ 
          isActive: false,
          status: 'deleted',
          updatedAt: new Date()
        })
        .where(eq(blogPosts.id, id))
        .returning();

      if (!deletedPost) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json({ 
        message: 'Post deleted successfully (soft delete)',
        deleted: deletedPost,
        permanent: false
      });
    }
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

// Restore soft-deleted blog post - Admin only
router.patch('/admin/posts/:id/restore', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const { id } = req.params;

    const [restoredPost] = await db
      .update(blogPosts)
      .set({ 
        isActive: true,
        status: 'published',
        updatedAt: new Date()
      })
      .where(and(
        eq(blogPosts.id, id),
        eq(blogPosts.isActive, false)
      ))
      .returning();

    if (!restoredPost) {
      return res.status(404).json({ error: 'Deleted post not found' });
    }

    console.log(`🔄 Restored blog post: ${restoredPost.title}`);

    res.json({ 
      message: 'Post restored successfully',
      restored: restoredPost
    });
  } catch (error) {
    console.error('Error restoring blog post:', error);
    res.status(500).json({ error: 'Failed to restore blog post' });
  }
});

// Get deleted posts - Admin only
router.get('/admin/posts/deleted', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const deletedPosts = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.isActive, false))
      .orderBy(desc(blogPosts.updatedAt));

    res.json({ 
      posts: deletedPosts,
      count: deletedPosts.length
    });
  } catch (error) {
    console.error('Error fetching deleted posts:', error);
    res.status(500).json({ error: 'Failed to fetch deleted posts' });
  }
});

// Manage blog topics - Admin only
router.get('/admin/topics', requireAdminViaSubscription, async (req, res) => {
  try {
    // In development mode, return mock topics
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      console.log('🔄 Admin blog topics bypassed in mock mode');
      const mockTopics = [
        {
          id: 1,
          title: 'Understanding Non-Disclosure Agreements',
          description: 'Complete guide to NDAs and confidentiality agreements',
          category: 'contract-law',
          difficulty: 'beginner',
          keywords: 'NDA, confidentiality, contracts',
          targetAudience: 'business-owners',
          priority: 10,
          isUsed: true,
          usedAt: new Date('2024-01-15'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 2,
          title: 'Employment Contract Red Flags',
          description: 'Warning signs in employment contracts',
          category: 'employment-law',
          difficulty: 'beginner',
          keywords: 'employment, contracts, worker rights',
          targetAudience: 'general',
          priority: 9,
          isUsed: true,
          usedAt: new Date('2024-01-10'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-10')
        },
        {
          id: 3,
          title: 'Software License Agreement Basics',
          description: 'Understanding SaaS and software licensing terms',
          category: 'intellectual-property',
          difficulty: 'intermediate',
          keywords: 'software license, SaaS, IP',
          targetAudience: 'business-owners',
          priority: 8,
          isUsed: false,
          usedAt: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];
      return res.json({ topics: mockTopics });
    }

    await db;

    const topics = await db
      .select()
      .from(blogTopics)
      .orderBy(desc(blogTopics.priority), asc(blogTopics.createdAt));

    res.json({ topics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

router.post('/admin/topics', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const validatedData = blogTopicSchema.parse(req.body);

    const [newTopic] = await db
      .insert(blogTopics)
      .values(validatedData)
      .returning();

    res.status(201).json({ topic: newTopic });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// Update blog topic - Admin only
router.put('/admin/topics/:id', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const { id } = req.params;
    const validatedData = blogTopicSchema.partial().parse(req.body);

    const [updatedTopic] = await db
      .update(blogTopics)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(blogTopics.id, id))
      .returning();

    if (!updatedTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    console.log(`📝 Updated blog topic: ${updatedTopic.title}`);

    res.json({ topic: updatedTopic });
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ error: 'Failed to update topic' });
  }
});

// Delete blog topic - Admin only
router.delete('/admin/topics/:id', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const { id } = req.params;

    const [deletedTopic] = await db
      .delete(blogTopics)
      .where(eq(blogTopics.id, id))
      .returning();

    if (!deletedTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    console.log(`🗑️ Deleted blog topic: ${deletedTopic.title}`);

    res.json({ message: 'Topic deleted successfully', deleted: deletedTopic });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// Reset topic usage - Admin only
router.patch('/admin/topics/:id/reset', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    const { id } = req.params;

    const [resetTopic] = await db
      .update(blogTopics)
      .set({
        isUsed: false,
        usedAt: null,
        updatedAt: new Date()
      })
      .where(eq(blogTopics.id, id))
      .returning();

    if (!resetTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    console.log(`🔄 Reset topic usage: ${resetTopic.title}`);

    res.json({ message: 'Topic reset successfully', topic: resetTopic });
  } catch (error) {
    console.error('Error resetting topic:', error);
    res.status(500).json({ error: 'Failed to reset topic' });
  }
});

// Blog scheduler controls - Admin only
router.get('/admin/scheduler/status', requireAdminViaSubscription, async (req, res) => {
  try {
    const status = blogScheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

router.post('/admin/scheduler/start', requireAdminViaSubscription, async (req, res) => {
  try {
    blogScheduler.start();
    res.json({ message: 'Scheduler started successfully' });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

router.post('/admin/scheduler/stop', requireAdminViaSubscription, async (req, res) => {
  try {
    blogScheduler.stop();
    res.json({ message: 'Scheduler stopped successfully' });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

router.post('/admin/scheduler/trigger', requireAdminViaSubscription, async (req, res) => {
  try {
    const result = await blogScheduler.triggerManualPost();
    res.json(result);
  } catch (error) {
    console.error('Error triggering manual post:', error);
    res.status(500).json({ error: 'Failed to trigger manual post' });
  }
});

// Seed topics endpoint - Admin only
router.post('/admin/seed-topics', requireAdminViaSubscription, async (req, res) => {
  try {
    const result = await blogContentService.seedTopics();
    if (result.success) {
      res.json({ 
        message: 'Topics seeded successfully', 
        count: result.topics?.length || 0,
        topics: result.topics 
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to seed topics' });
    }
  } catch (error) {
    console.error('Error seeding topics:', error);
    res.status(500).json({ error: 'Failed to seed topics' });
  }
});

// Generate bulk topics using AI - Admin only
router.post('/admin/generate-bulk-topics', requireAdminViaSubscription, async (req, res) => {
  try {
    const { count = 30 } = req.body;

    // Validate count
    if (count < 1 || count > 100) {
      return res.status(400).json({ error: 'Count must be between 1 and 100' });
    }

    console.log(`📝 Starting bulk topic generation for ${count} topics...`);

    const result = await blogContentService.generateBulkTopics(count);

    if (result.success) {
      res.json({
        message: `Successfully generated ${result.topics?.length || 0} new topics`,
        count: result.topics?.length || 0,
        topics: result.topics,
        requested: count
      });
    } else {
      res.status(500).json({ 
        error: result.error || 'Failed to generate topics',
        requested: count
      });
    }
  } catch (error) {
    console.error('Error generating bulk topics:', error);
    res.status(500).json({ error: 'Failed to generate bulk topics' });
  }
});

// Generate monthly topics (30 days worth) - Admin only
router.post('/admin/generate-monthly-topics', requireAdminViaSubscription, async (req, res) => {
  try {
    console.log('📅 Generating monthly topic batch (30 topics)...');

    const result = await blogContentService.generateBulkTopics(30);

    if (result.success) {
      res.json({
        message: `Monthly topic generation complete! Generated ${result.topics?.length || 0} topics for the next month`,
        count: result.topics?.length || 0,
        topics: result.topics,
        period: '30 days'
      });
    } else {
      res.status(500).json({ 
        error: result.error || 'Failed to generate monthly topics'
      });
    }
  } catch (error) {
    console.error('Error generating monthly topics:', error);
    res.status(500).json({ error: 'Failed to generate monthly topics' });
  }
});

// Get blog statistics - Admin only
router.get('/admin/stats', requireAdminViaSubscription, async (req, res) => {
  try {
    await db;

    // Get total statistics for all posts
    const totalStatsResult = await db
      .select({
        totalPosts: sql`count(*)`,
        publishedPosts: sql`count(case when status = 'published' then 1 end)`,
        totalViews: sql`sum(coalesce(view_count, 0))`,
        totalShares: sql`sum(coalesce(share_count, 0))`,
        avgReadingTime: sql`avg(reading_time)`
      })
      .from(blogPosts)
      .where(eq(blogPosts.isActive, true));

    const stats = totalStatsResult[0];

    // Get topics statistics
    const topicsStatsResult = await db
      .select({
        totalTopics: sql`count(*)`,
        usedTopics: sql`count(case when is_used = true then 1 end)`,
        availableTopics: sql`count(case when is_used = false then 1 end)`
      })
      .from(blogTopics);

    const topicsStats = topicsStatsResult[0];

    // Get recent activity (posts published in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivityResult = await db
      .select({
        recentPosts: sql`count(*)`
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.status, 'published'),
          eq(blogPosts.isActive, true),
          gte(blogPosts.publishedAt, thirtyDaysAgo)
        )
      );

    const recentActivity = recentActivityResult[0];

    res.json({
      posts: {
        total: parseInt(stats.totalPosts as string) || 0,
        published: parseInt(stats.publishedPosts as string) || 0,
        totalViews: parseInt(stats.totalViews as string) || 0,
        totalShares: parseInt(stats.totalShares as string) || 0,
        avgReadingTime: Math.round(parseFloat(stats.avgReadingTime as string) || 0),
        recentPosts: parseInt(recentActivity.recentPosts as string) || 0
      },
      topics: {
        total: parseInt(topicsStats.totalTopics as string) || 0,
        used: parseInt(topicsStats.usedTopics as string) || 0,
        available: parseInt(topicsStats.availableTopics as string) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching blog stats:', error);
    res.status(500).json({ error: 'Failed to fetch blog stats' });
  }
});

// Get SEO metrics - Admin only
router.get('/admin/seo-metrics', requireAdminViaSubscription, async (req, res) => {
  try {
    // In development mode, return mock SEO metrics
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      console.log('🔄 Admin SEO metrics bypassed in mock mode');
      const mockMetrics = [
        {
          postId: 1,
          targetKeyword: 'NDA agreement',
          searchVolume: 1200,
          impressions: 3400,
          clicks: 156,
          clickThroughRate: '4.6',
          lastChecked: new Date(),
          title: 'Understanding Non-Disclosure Agreements: A Complete Guide',
          slug: 'understanding-nda-contracts'
        },
        {
          postId: 2,
          targetKeyword: 'employment contract',
          searchVolume: 890,
          impressions: 2100,
          clicks: 89,
          clickThroughRate: '4.2',
          lastChecked: new Date(),
          title: 'Employment Contract Red Flags Every Worker Should Know',
          slug: 'employment-contract-red-flags'
        }
      ];
      return res.json({ metrics: mockMetrics });
    }

    await db;

    const metrics = await db
      .select({
        postId: seoMetrics.postId,
        targetKeyword: seoMetrics.targetKeyword,
        searchVolume: seoMetrics.searchVolume,
        impressions: seoMetrics.impressions,
        clicks: seoMetrics.clicks,
        clickThroughRate: seoMetrics.clickThroughRate,
        lastChecked: seoMetrics.lastChecked,
        title: blogPosts.title,
        slug: blogPosts.slug,
      })
      .from(seoMetrics)
      .leftJoin(blogPosts, eq(seoMetrics.postId, blogPosts.id))
      .orderBy(desc(seoMetrics.lastChecked))
      .limit(50);

    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching SEO metrics:', error);
    res.status(500).json({ error: 'Failed to fetch SEO metrics' });
  }
});

export default router;