import * as cron from 'node-cron';
import { blogContentService } from './blog-content-service.js';
import { db } from './db.js';
import { blogPosts, seoMetrics } from '@shared/schema';
import { eq, and, isNotNull, gte } from 'drizzle-orm';

interface SchedulerConfig {
  enabled: boolean;
  postsPerDay: number;
  hours: number[]; // Hours of day to post (0-23)
  maxPostsPerHour: number;
  timezone: string;
  minHoursBetweenPosts: number;
}

export class BlogScheduler {
  private config: SchedulerConfig;
  private isRunning: boolean = false;
  private scheduledJobs: cron.ScheduledTask[] = [];

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      enabled: process.env.BLOG_SCHEDULER_ENABLED === 'true',
      postsPerDay: parseInt(process.env.BLOG_POSTS_PER_DAY || '3'),
      hours: this.parseHours(process.env.BLOG_POST_HOURS || '9,13,17'), // 9 AM, 1 PM, 5 PM
      maxPostsPerHour: 1,
      timezone: process.env.TZ || 'America/New_York',
      minHoursBetweenPosts: parseInt(process.env.MIN_HOURS_BETWEEN_POSTS || '4'),
      ...config,
    };

    console.log('Blog Scheduler initialized with config:', this.config);
  }

  private parseHours(hoursString: string): number[] {
    return hoursString.split(',').map(h => parseInt(h.trim())).filter(h => h >= 0 && h <= 23);
  }

  // Start the automated blog posting scheduler
  start() {
    if (!this.config.enabled) {
      console.log('Blog scheduler is disabled via configuration');
      return;
    }

    if (this.isRunning) {
      console.log('Blog scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting blog scheduler...');

    // Schedule posts at specified hours
    this.config.hours.forEach(hour => {
      const cronExpression = `0 ${hour} * * *`; // Every day at specified hour
      
      const job = cron.schedule(cronExpression, async () => {
        await this.handleScheduledPost(hour);
      }, {
        scheduled: false,
        timezone: this.config.timezone,
      });

      this.scheduledJobs.push(job);
      job.start();
      
      console.log(`Scheduled blog posts for ${hour}:00 (${this.config.timezone})`);
    });

    // Schedule daily analytics update
    const analyticsJob = cron.schedule('0 2 * * *', async () => {
      await this.updateAnalytics();
    }, {
      scheduled: false,
      timezone: this.config.timezone,
    });

    this.scheduledJobs.push(analyticsJob);
    analyticsJob.start();

    console.log(`Blog scheduler started with ${this.scheduledJobs.length} scheduled jobs`);
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('Blog scheduler is not running');
      return;
    }

    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];
    this.isRunning = false;
    
    console.log('Blog scheduler stopped');
  }

  // Handle a scheduled post generation
  private async handleScheduledPost(hour: number) {
    try {
      console.log(`Running scheduled blog post generation at ${hour}:00`);

      // Check if we've already posted enough times today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaysPosts = await this.getPostsCount(today);
      
      if (todaysPosts >= this.config.postsPerDay) {
        console.log(`Already posted ${todaysPosts} times today (limit: ${this.config.postsPerDay})`);
        return;
      }

      // Check if enough time has passed since last post
      const lastPost = await this.getLastPostTime();
      if (lastPost) {
        const hoursSinceLastPost = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastPost < this.config.minHoursBetweenPosts) {
          console.log(`Only ${hoursSinceLastPost.toFixed(1)} hours since last post (minimum: ${this.config.minHoursBetweenPosts})`);
          return;
        }
      }

      // Generate and publish post
      const result = await blogContentService.generateAndPublishPost();
      
      if (result.success) {
        console.log(`✅ Successfully generated and published blog post (ID: ${result.postId})`);
        
        // Log to analytics/monitoring if needed
        await this.logPostingActivity(result.postId!, 'auto-generated', hour);
      } else {
        console.error(`❌ Failed to generate blog post: ${result.error}`);
        
        // Could implement retry logic or alerting here
        await this.logPostingActivity(null, 'failed', hour, result.error);
      }
    } catch (error) {
      console.error('Error in scheduled post generation:', error);
      await this.logPostingActivity(null, 'error', hour, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Get count of posts published today
  private async getPostsCount(since: Date): Promise<number> {
    try {
      await db;
      
      const result = await db
        .select({ count: blogPosts.id })
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.status, 'published'),
            gte(blogPosts.publishedAt, since),
            isNotNull(blogPosts.publishedAt)
          )
        );

      return result.length;
    } catch (error) {
      console.error('Error getting posts count:', error);
      return 0;
    }
  }

  // Get the timestamp of the last published post
  private async getLastPostTime(): Promise<Date | null> {
    try {
      await db;
      
      const result = await db
        .select({ publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.status, 'published'),
            isNotNull(blogPosts.publishedAt)
          )
        )
        .orderBy(blogPosts.publishedAt)
        .limit(1);

      return result[0]?.publishedAt || null;
    } catch (error) {
      console.error('Error getting last post time:', error);
      return null;
    }
  }

  // Log posting activity for monitoring
  private async logPostingActivity(
    postId: string | null, 
    status: 'auto-generated' | 'failed' | 'error', 
    hour: number,
    error?: string
  ) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        postId,
        status,
        hour,
        error,
        config: this.config,
      };

      console.log('Blog Posting Activity:', JSON.stringify(logEntry, null, 2));
      
      // Could store this in a dedicated logging table or external service
    } catch (error) {
      console.error('Error logging posting activity:', error);
    }
  }

  // Update SEO analytics and metrics
  private async updateAnalytics() {
    try {
      console.log('Running daily analytics update...');
      
      await db;
      
      // Get all published posts from the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const recentPosts = await db
        .select()
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.status, 'published'),
            gte(blogPosts.publishedAt, thirtyDaysAgo)
          )
        );

      for (const post of recentPosts) {
        // Simulate SEO metrics update (in a real implementation, 
        // you'd integrate with Google Search Console API, analytics, etc.)
        const mockMetrics = this.generateMockSEOMetrics(post);
        
        try {
          await db.insert(seoMetrics).values({
            postId: post.id,
            targetKeyword: post.keywords?.split(',')[0] || 'contract law',
            searchVolume: mockMetrics.searchVolume,
            difficulty: mockMetrics.difficulty,
            impressions: mockMetrics.impressions,
            clicks: mockMetrics.clicks,
            clickThroughRate: mockMetrics.ctr.toString(),
          });
        } catch (error) {
          // Metrics might already exist for today
          console.log(`Metrics for post ${post.id} may already exist`);
        }
      }

      console.log(`Updated analytics for ${recentPosts.length} posts`);
    } catch (error) {
      console.error('Error updating analytics:', error);
    }
  }

  // Generate mock SEO metrics (replace with real API integration)
  private generateMockSEOMetrics(post: any) {
    const baseVolume = 100;
    const randomMultiplier = Math.random() * 10 + 1;
    
    return {
      searchVolume: Math.floor(baseVolume * randomMultiplier),
      difficulty: Math.floor(Math.random() * 40) + 20, // 20-60 difficulty
      impressions: Math.floor(Math.random() * 1000) + 100,
      clicks: Math.floor(Math.random() * 50) + 5,
      ctr: (Math.random() * 0.05 + 0.01), // 1-6% CTR
    };
  }

  // Manual trigger for testing
  async triggerManualPost(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Manually triggering blog post generation...');
      
      const result = await blogContentService.generateAndPublishPost();
      
      if (result.success) {
        const message = `Successfully generated manual blog post (ID: ${result.postId})`;
        console.log(message);
        return { success: true, message };
      } else {
        const message = `Failed to generate manual blog post: ${result.error}`;
        console.error(message);
        return { success: false, message };
      }
    } catch (error) {
      const message = `Error in manual post generation: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(message);
      return { success: false, message };
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      scheduledJobs: this.scheduledJobs.length,
      nextRuns: this.config.hours.map(hour => {
        const next = new Date();
        next.setHours(hour, 0, 0, 0);
        if (next <= new Date()) {
          next.setDate(next.getDate() + 1);
        }
        return {
          hour,
          nextRun: next.toISOString(),
        };
      }),
    };
  }
}

// Create and export scheduler instance
export const blogScheduler = new BlogScheduler();