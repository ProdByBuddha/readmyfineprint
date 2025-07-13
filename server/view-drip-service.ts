import { db } from './db.js';
import { blogPosts } from '@shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

interface ViewDripConfig {
  enabled: boolean;
  intervalMinutes: number;
  minIncrement: number;
  maxIncrement: number;
  maxMultiplier: number;
}

class ViewDripService {
  private config: ViewDripConfig;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      enabled: process.env.VIEW_DRIP_ENABLED !== 'false',
      intervalMinutes: parseInt(process.env.VIEW_DRIP_INTERVAL_MINUTES || '30'),
      minIncrement: parseInt(process.env.VIEW_DRIP_MIN_INCREMENT || '1'),
      maxIncrement: parseInt(process.env.VIEW_DRIP_MAX_INCREMENT || '5'),
      maxMultiplier: parseFloat(process.env.VIEW_DRIP_MAX_MULTIPLIER || '3.0'),
    };
  }

  start() {
    if (this.intervalId) {
      console.log('View drip service already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('View drip service is disabled');
      return;
    }

    console.log('Starting view drip service...');
    this.intervalId = setInterval(() => {
      this.incrementArtificialCounts().catch(console.error);
    }, this.config.intervalMinutes * 60 * 1000);
    
    this.incrementArtificialCounts().catch(console.error);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('View drip service stopped');
    }
  }

  async incrementArtificialCounts() {
    try {
      await db;
      
      const publishedPosts = await db
        .select()
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.status, 'published'),
            eq(blogPosts.isActive, true),
            isNotNull(blogPosts.publishedAt)
          )
        );

      if (publishedPosts.length === 0) {
        console.log('No published posts found for view drip service');
        return;
      }

      for (const post of publishedPosts) {
        const postAge = Date.now() - new Date(post.publishedAt!).getTime();
        const daysOld = postAge / (24 * 60 * 60 * 1000);
        
        // Handle view count increments
        await this.incrementArtificialViews(post, daysOld);
        
        // Handle share count increments (with different logic)
        await this.incrementArtificialShares(post, daysOld);
      }
    } catch (error) {
      console.error('Error incrementing artificial counts:', error);
    }
  }

  private async incrementArtificialViews(post: any, daysOld: number) {
    const realViews = post.viewCount || 0;
    const currentArtificial = post.artificialViewCount || 0;
    const maxArtificialViews = Math.floor(realViews * this.config.maxMultiplier);
    
    if (currentArtificial >= maxArtificialViews && realViews > 0) {
      return;
    }
    
    const probability = this.calculateViewIncrementProbability(daysOld, realViews);
    
    if (Math.random() < probability) {
      const increment = this.getRandomViewIncrement(daysOld, realViews);
      const newArtificialViews = Math.min(
        currentArtificial + increment,
        maxArtificialViews
      );
      
      await db
        .update(blogPosts)
        .set({ 
          artificialViewCount: newArtificialViews
        })
        .where(eq(blogPosts.id, post.id));
      
      console.log(`Post ${post.id}: +${increment} artificial views (${currentArtificial} → ${newArtificialViews})`);
    }
  }

  private async incrementArtificialShares(post: any, daysOld: number) {
    const realShares = post.shareCount || 0;
    const currentArtificial = post.artificialShareCount || 0;
    const realViews = post.viewCount || 0;
    
    // Share count is typically much lower than view count
    // Use a smaller multiplier and different base calculation
    const baseShares = Math.max(1, Math.floor(realViews / 50)); // Rough conversion: 1 share per 50 views
    const maxArtificialShares = Math.floor((realShares + baseShares) * 2.0); // Lower multiplier for shares
    
    if (currentArtificial >= maxArtificialShares) {
      return;
    }
    
    const probability = this.calculateShareIncrementProbability(daysOld, realShares, realViews);
    
    if (Math.random() < probability) {
      const increment = this.getRandomShareIncrement(daysOld, realShares, realViews);
      const newArtificialShares = Math.min(
        currentArtificial + increment,
        maxArtificialShares
      );
      
      await db
        .update(blogPosts)
        .set({ 
          artificialShareCount: newArtificialShares
        })
        .where(eq(blogPosts.id, post.id));
      
      console.log(`Post ${post.id}: +${increment} artificial shares (${currentArtificial} → ${newArtificialShares})`);
    }
  }

  private calculateViewIncrementProbability(daysOld: number, realViews: number): number {
    if (realViews === 0) return 0.1;
    
    let baseProbability = 0.4;
    
    if (daysOld < 1) baseProbability = 0.8;
    else if (daysOld < 7) baseProbability = 0.6;
    else if (daysOld < 30) baseProbability = 0.4;
    else baseProbability = 0.2;
    
    const viewBonus = Math.min(realViews / 100, 0.3);
    
    return Math.min(baseProbability + viewBonus, 0.9);
  }

  private calculateShareIncrementProbability(daysOld: number, realShares: number, realViews: number): number {
    // Shares are less frequent than views, so lower base probability
    let baseProbability = 0.2;
    
    if (daysOld < 1) baseProbability = 0.4;
    else if (daysOld < 7) baseProbability = 0.3;
    else if (daysOld < 30) baseProbability = 0.2;
    else baseProbability = 0.1;
    
    // Bonus based on view count (more views = more likely to be shared)
    const viewBonus = Math.min(realViews / 200, 0.2);
    
    // Bonus based on existing shares (viral effect)
    const shareBonus = Math.min(realShares / 10, 0.1);
    
    return Math.min(baseProbability + viewBonus + shareBonus, 0.6);
  }

  private getRandomViewIncrement(daysOld: number, realViews: number): number {
    let baseMax = this.config.maxIncrement;
    
    if (daysOld < 1) baseMax = 12;
    else if (daysOld < 7) baseMax = 8;
    else if (daysOld < 30) baseMax = 5;
    else baseMax = 3;
    
    if (realViews > 50) baseMax = Math.ceil(baseMax * 1.5);
    
    return Math.floor(Math.random() * (baseMax - this.config.minIncrement + 1)) + this.config.minIncrement;
  }

  private getRandomShareIncrement(daysOld: number, realShares: number, realViews: number): number {
    // Shares increment much more slowly than views
    let baseMax = 2;
    
    if (daysOld < 1) baseMax = 3;
    else if (daysOld < 7) baseMax = 2;
    else if (daysOld < 30) baseMax = 1;
    else baseMax = 1;
    
    // High-performing posts get slightly more shares
    if (realViews > 100) baseMax = Math.ceil(baseMax * 1.2);
    if (realShares > 5) baseMax = Math.ceil(baseMax * 1.1);
    
    return Math.floor(Math.random() * baseMax) + 1;
  }

  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      config: this.config
    };
  }

  updateConfig(newConfig: Partial<ViewDripConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.intervalId && newConfig.intervalMinutes) {
      this.stop();
      this.start();
    }
  }
}

export const viewDripService = new ViewDripService();