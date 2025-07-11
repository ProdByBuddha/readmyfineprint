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
    // In development mode, return mock blog posts
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      console.log('🔄 Blog posts bypassed in mock mode');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const mockPosts = [
        {
          id: 1,
          slug: 'understanding-nda-contracts',
          title: 'Understanding Non-Disclosure Agreements: A Complete Guide',
          excerpt: 'Learn everything you need to know about NDAs, when to use them, and how to negotiate better terms.',
          category: 'Contract Law',
          tags: ['NDA', 'confidentiality', 'contracts'],
          publishedAt: new Date('2024-01-15'),
          readingTime: 8,
          viewCount: 245,
          shareCount: 12,
          isFeatured: true,
          metaDescription: 'Complete guide to understanding and negotiating non-disclosure agreements',
          keywords: 'NDA, non-disclosure agreement, confidentiality, contract law'
        },
        {
          id: 2,
          slug: 'employment-contract-red-flags',
          title: 'Employment Contract Red Flags Every Worker Should Know',
          excerpt: 'Key warning signs in employment contracts that could harm your rights and how to spot them.',
          category: 'Employment Law',
          tags: ['employment', 'contracts', 'worker rights'],
          publishedAt: new Date('2024-01-10'),
          readingTime: 6,
          viewCount: 189,
          shareCount: 8,
          isFeatured: false,
          metaDescription: 'Warning signs in employment contracts that protect worker rights',
          keywords: 'employment contract, worker rights, contract negotiation'
        },
        {
          id: 3,
          slug: 'real-estate-contract-basics',
          title: 'Real Estate Contract Basics for First-Time Buyers',
          excerpt: 'Essential knowledge for understanding real estate purchase agreements and protecting yourself.',
          category: 'Real Estate',
          tags: ['real estate', 'property', 'contracts'],
          publishedAt: new Date('2024-01-05'),
          readingTime: 10,
          viewCount: 156,
          shareCount: 5,
          isFeatured: false,
          metaDescription: 'Guide to real estate contracts for first-time home buyers',
          keywords: 'real estate contract, property purchase, home buying'
        }
      ];
      
      const total = mockPosts.length;
      const totalPages = Math.ceil(total / limit);
      
      return res.json({
        posts: mockPosts.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    }

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
    // In development mode, return mock blog post
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      console.log('🔄 Blog post by slug bypassed in mock mode');
      const { slug } = req.params;
      
      const mockPosts = {
        'understanding-nda-contracts': {
          id: 1,
          slug: 'understanding-nda-contracts',
          title: 'Understanding Non-Disclosure Agreements: A Complete Guide',
          excerpt: 'Learn everything you need to know about NDAs, when to use them, and how to negotiate better terms.',
          content: `<h2>What is a Non-Disclosure Agreement?</h2>
          <p>A Non-Disclosure Agreement (NDA) is a legal contract that establishes a confidential relationship between parties...</p>
          <h2>When Should You Use an NDA?</h2>
          <p>NDAs are commonly used in business situations where sensitive information needs to be shared...</p>
          <h2>Key Terms to Understand</h2>
          <p>When reviewing an NDA, pay attention to these critical elements...</p>`,
          category: 'Contract Law',
          tags: ['NDA', 'confidentiality', 'contracts'],
          publishedAt: new Date('2024-01-15'),
          readingTime: 8,
          viewCount: 245,
          shareCount: 12,
          isFeatured: true,
          metaDescription: 'Complete guide to understanding and negotiating non-disclosure agreements',
          keywords: 'NDA, non-disclosure agreement, confidentiality, contract law',
          status: 'published',
          isActive: true,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        'employment-contract-red-flags': {
          id: 2,
          slug: 'employment-contract-red-flags',
          title: 'Employment Contract Red Flags Every Worker Should Know',
          excerpt: 'Key warning signs in employment contracts that could harm your rights and how to spot them.',
          content: `<h2>Common Employment Contract Red Flags</h2>
          <p>When reviewing an employment contract, watch out for these warning signs...</p>
          <h2>Non-Compete Clauses</h2>
          <p>Overly broad non-compete clauses can severely limit your future career options...</p>`,
          category: 'Employment Law',
          tags: ['employment', 'contracts', 'worker rights'],
          publishedAt: new Date('2024-01-10'),
          readingTime: 6,
          viewCount: 189,
          shareCount: 8,
          isFeatured: false,
          metaDescription: 'Warning signs in employment contracts that protect worker rights',
          keywords: 'employment contract, worker rights, contract negotiation',
          status: 'published',
          isActive: true,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10')
        }
      };
      
      const post = mockPosts[slug as keyof typeof mockPosts];
      if (!post) {
        return res.status(404).json({ error: 'Blog post not found' });
      }
      
      const relatedPosts = [
        {
          id: 3,
          slug: 'real-estate-contract-basics',
          title: 'Real Estate Contract Basics for First-Time Buyers',
          excerpt: 'Essential knowledge for understanding real estate purchase agreements.',
          publishedAt: new Date('2024-01-05'),
          readingTime: 10
        }
      ];
      
      return res.json({
        post: {
          ...post,
          viewCount: post.viewCount + 1
        },
        relatedPosts
      });
    }

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
    // In development mode, return mock categories
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      console.log('🔄 Blog categories bypassed in mock mode');
      const mockCategories = [
        { name: 'Contract Law', count: 5, slug: 'contract-law' },
        { name: 'Employment Law', count: 3, slug: 'employment-law' },
        { name: 'Real Estate', count: 2, slug: 'real-estate' }
      ];
      return res.json({ categories: mockCategories });
    }

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
    const categoryCounts = categories.reduce((acc: any, cat: any) => {
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
    // In development mode, return mock sitemap
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      console.log('🔄 Blog sitemap bypassed in mock mode');
      const mockSitemapPosts = [
        {
          slug: 'understanding-nda-contracts',
          updatedAt: new Date('2024-01-15'),
          publishedAt: new Date('2024-01-15')
        },
        {
          slug: 'employment-contract-red-flags',
          updatedAt: new Date('2024-01-10'),
          publishedAt: new Date('2024-01-10')
        },
        {
          slug: 'real-estate-contract-basics',
          updatedAt: new Date('2024-01-05'),
          publishedAt: new Date('2024-01-05')
        }
      ];
      return res.json({ posts: mockSitemapPosts });
    }

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
    // In development mode, return mock admin posts
    if (process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
      console.log('🔄 Admin blog posts bypassed in mock mode');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const mockAdminPosts = [
        {
          id: 1,
          slug: 'understanding-nda-contracts',
          title: 'Understanding Non-Disclosure Agreements: A Complete Guide',
          excerpt: 'Learn everything you need to know about NDAs, when to use them, and how to negotiate better terms.',
          category: 'Contract Law',
          status: 'published',
          isActive: true,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          publishedAt: new Date('2024-01-15'),
          wordCount: 1200,
          readingTime: 8
        },
        {
          id: 2,
          slug: 'employment-contract-red-flags',
          title: 'Employment Contract Red Flags Every Worker Should Know',
          excerpt: 'Key warning signs in employment contracts that could harm your rights and how to spot them.',
          category: 'Employment Law',
          status: 'published',
          isActive: true,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10'),
          publishedAt: new Date('2024-01-10'),
          wordCount: 900,
          readingTime: 6
        },
        {
          id: 3,
          slug: 'draft-post-example',
          title: 'Draft Post Example',
          excerpt: 'This is a draft post for testing purposes.',
          category: 'Contract Law',
          status: 'draft',
          isActive: true,
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20'),
          publishedAt: null,
          wordCount: 500,
          readingTime: 3
        }
      ];
      
      const total = mockAdminPosts.length;
      const totalPages = Math.ceil(total / limit);
      
      return res.json({
        posts: mockAdminPosts.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    }

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