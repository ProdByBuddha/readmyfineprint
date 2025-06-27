import { Router } from 'express';
import { db } from './db.js';
import { 
  blogPosts, 
  blogTopics, 
  contentGeneration, 
  seoMetrics,
  blogPostSchema,
  blogTopicSchema,
  BlogPost,
  BlogTopic
} from '@shared/schema';
import { eq, desc, asc, and, ilike, isNotNull, gte, or } from 'drizzle-orm';
import { blogContentService } from './blog-content-service.js';
import { blogScheduler } from './blog-scheduler.js';
import { requireAdminAuth } from './auth.js';

const router = Router();

// Public routes
// Get all published blog posts with pagination
router.get('/posts', async (req, res) => {
  try {
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
        shareCount: blogPosts.shareCount,
        isFeatured: blogPosts.isFeatured,
        metaDescription: blogPosts.metaDescription,
        keywords: blogPosts.keywords,
      })
      .from(blogPosts)
      .where(whereConditions)
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
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
    
    const filteredRelated = relatedPosts.filter(p => p.id !== post.id);
    
    res.json({
      post: {
        ...post,
        viewCount: (post.viewCount || 0) + 1,
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
    await db;
    
    const categories = await db
      .select({
        category: blogPosts.category,
        count: blogPosts.id,
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
    
    // Count posts per category
    const categoryCounts = categories.reduce((acc, cat) => {
      acc[cat.category] = (acc[cat.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const formattedCategories = Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
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
router.get('/admin/posts', requireAdminAuth, async (req, res) => {
  try {
    await db;
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    
    const offset = (page - 1) * limit;
    
    let whereConditions = eq(blogPosts.isActive, true);
    
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
router.post('/admin/posts', requireAdminAuth, async (req, res) => {
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
router.put('/admin/posts/:id', requireAdminAuth, async (req, res) => {
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

// Delete blog post - Admin only
router.delete('/admin/posts/:id', requireAdminAuth, async (req, res) => {
  try {
    await db;
    
    const { id } = req.params;
    
    const [deletedPost] = await db
      .update(blogPosts)
      .set({ isActive: false })
      .where(eq(blogPosts.id, id))
      .returning();
    
    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

// Manage blog topics - Admin only
router.get('/admin/topics', requireAdminAuth, async (req, res) => {
  try {
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

router.post('/admin/topics', requireAdminAuth, async (req, res) => {
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

// Blog scheduler controls - Admin only
router.get('/admin/scheduler/status', requireAdminAuth, async (req, res) => {
  try {
    const status = blogScheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

router.post('/admin/scheduler/start', requireAdminAuth, async (req, res) => {
  try {
    blogScheduler.start();
    res.json({ message: 'Scheduler started successfully' });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

router.post('/admin/scheduler/stop', requireAdminAuth, async (req, res) => {
  try {
    blogScheduler.stop();
    res.json({ message: 'Scheduler stopped successfully' });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

router.post('/admin/scheduler/trigger', requireAdminAuth, async (req, res) => {
  try {
    const result = await blogScheduler.triggerManualPost();
    res.json(result);
  } catch (error) {
    console.error('Error triggering manual post:', error);
    res.status(500).json({ error: 'Failed to trigger manual post' });
  }
});

// Seed topics endpoint - Admin only
router.post('/admin/seed-topics', requireAdminAuth, async (req, res) => {
  try {
    await blogContentService.seedTopics();
    res.json({ message: 'Topics seeded successfully' });
  } catch (error) {
    console.error('Error seeding topics:', error);
    res.status(500).json({ error: 'Failed to seed topics' });
  }
});

// Get SEO metrics - Admin only
router.get('/admin/seo-metrics', requireAdminAuth, async (req, res) => {
  try {
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