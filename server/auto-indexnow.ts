
import { indexNowService } from './indexnow-service';

class AutoIndexNowManager {
  private submissionQueue: Set<string> = new Set();
  private isProcessing = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  
  /**
   * Add URL(s) to the submission queue
   */
  queueUrlForSubmission(url: string | string[]) {
    const urls = Array.isArray(url) ? url : [url];
    
    urls.forEach(u => {
      if (this.isValidUrl(u)) {
        this.submissionQueue.add(u);
      }
    });

    // Debounce submissions to avoid too many API calls
    this.scheduleSubmission();
  }

  /**
   * Queue all public URLs for submission
   */
  queueAllUrls() {
    console.log('🔄 Queuing all public URLs for IndexNow submission...');
    
    // This will add all public URLs to the queue
    const baseHost = process.env.BASE_HOST || 'readmyfineprint.com';
    const baseUrl = `https://${baseHost}`;
    
    const allUrls = [
      `${baseUrl}/`,
      `${baseUrl}/privacy`,
      `${baseUrl}/terms`,
      `${baseUrl}/cookies`,
      `${baseUrl}/donate`,
      `${baseUrl}/roadmap`,
      `${baseUrl}/subscription`
    ];

    allUrls.forEach(url => this.submissionQueue.add(url));
    this.scheduleSubmission();
  }

  /**
   * Schedule a debounced submission
   */
  private scheduleSubmission() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Wait 30 seconds before submitting to batch multiple changes
    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, 30000);
  }

  /**
   * Process the submission queue
   */
  private async processQueue() {
    if (this.isProcessing || this.submissionQueue.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const urlsToSubmit = Array.from(this.submissionQueue);
      console.log(`🚀 Auto-submitting ${urlsToSubmit.length} URLs to IndexNow...`);

      const results = await indexNowService.submitUrls(urlsToSubmit);
      const successCount = results.filter((r: any) => r.success).length;
      
      console.log(`✅ Auto-submission complete: ${successCount}/${results.length} search engines notified`);
      
      // Clear the queue after successful submission
      this.submissionQueue.clear();

    } catch (error) {
      console.error('❌ Auto IndexNow submission failed:', error);
      // Don't clear the queue on error - will retry on next change
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Force immediate submission (bypass debounce)
   */
  async forceSubmission(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    await this.processQueue();
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueSize: this.submissionQueue.size,
      isProcessing: this.isProcessing,
      queuedUrls: Array.from(this.submissionQueue)
    };
  }
}

export const autoIndexNow = new AutoIndexNowManager();

// Helper functions to trigger submissions
export function notifyUrlChanged(url: string) {
  autoIndexNow.queueUrlForSubmission(url);
}

export function notifyContentUpdated() {
  autoIndexNow.queueAllUrls();
}

export function notifyNewDeployment() {
  // On new deployment, submit all URLs
  autoIndexNow.queueAllUrls();
}
