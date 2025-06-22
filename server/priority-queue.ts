import { EventEmitter } from 'events';

interface QueuedRequest {
  id: string;
  priority: number;
  subscriptionTier: string;
  userId: string;
  timestamp: number;
  processFunction: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class PriorityProcessingQueue extends EventEmitter {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private concurrentLimit = 3; // Max concurrent document analyses
  private currentlyProcessing = 0;
  private processingSet = new Set<string>(); // Track processing request IDs

  constructor() {
    super();
  }

  /**
   * Get priority level based on subscription tier
   */
  private getPriority(subscriptionTier: string): number {
    const priorities = {
      'enterprise': 1,
      'business': 2, 
      'professional': 3,
      'starter': 4,
      'free': 5
    };
    return priorities[subscriptionTier as keyof typeof priorities] || 5;
  }

  /**
   * Add a document processing request to the priority queue
   */
  async addToQueue(
    userId: string,
    subscriptionTier: string,
    processFunction: () => Promise<any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const priority = this.getPriority(subscriptionTier);
      const request: QueuedRequest = {
        id: `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        priority,
        subscriptionTier,
        userId,
        timestamp: Date.now(),
        processFunction,
        resolve,
        reject
      };

      // Insert request in priority order (lower number = higher priority)
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].priority > priority || 
           (this.queue[i].priority === priority && this.queue[i].timestamp > request.timestamp)) {
          this.queue.splice(i, 0, request);
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        this.queue.push(request);
      }

      console.log(`[Priority Queue] Added ${subscriptionTier} tier request (priority: ${priority}). Queue length: ${this.queue.length}`);
      
      // Start processing with a small delay to allow proper queue ordering
      setImmediate(() => this.processQueue());
    });
  }

  /**
   * Process the queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0 || this.currentlyProcessing >= this.concurrentLimit) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.currentlyProcessing < this.concurrentLimit) {
      const request = this.queue.shift();
      if (!request) break;

      this.currentlyProcessing++;
      this.processingSet.add(request.id);

      console.log(`[Priority Queue] Processing ${request.subscriptionTier} tier request. Currently processing: ${this.currentlyProcessing}/${this.concurrentLimit}`);

      // Process request without blocking the queue
      this.processRequest(request).finally(() => {
        this.currentlyProcessing--;
        this.processingSet.delete(request.id);
        
        // Continue processing queue after a small delay to allow queue reordering
        setImmediate(() => this.processQueue());
      });
    }

    this.processing = false;
  }

  /**
   * Process individual request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    try {
      const startTime = Date.now();
      const result = await request.processFunction();
      const processingTime = Date.now() - startTime;
      
      console.log(`[Priority Queue] Completed ${request.subscriptionTier} tier request in ${processingTime}ms`);
      request.resolve(result);
    } catch (error) {
      console.error(`[Priority Queue] Error processing ${request.subscriptionTier} tier request:`, error);
      request.reject(error);
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const stats = {
      queueLength: this.queue.length,
      currentlyProcessing: this.currentlyProcessing,
      concurrentLimit: this.concurrentLimit,
      queueByTier: {} as Record<string, number>
    };

    // Count requests by tier
    this.queue.forEach(request => {
      stats.queueByTier[request.subscriptionTier] = (stats.queueByTier[request.subscriptionTier] || 0) + 1;
    });

    return stats;
  }

  /**
   * Check if user has requests in queue (to prevent spam)
   */
  hasUserRequestInQueue(userId: string): boolean {
    return this.queue.some(request => request.userId === userId) || 
           Array.from(this.processingSet).some(id => id.startsWith(userId));
  }

  /**
   * Get estimated wait time for a new request of given subscription tier
   */
  getEstimatedWaitTime(subscriptionTier: string): number {
    const priority = this.getPriority(subscriptionTier);
    let position = 0;
    
    // Count how many higher or equal priority requests are ahead
    for (const request of this.queue) {
      if (request.priority < priority || 
         (request.priority === priority && request.timestamp < Date.now())) {
        position++;
      }
    }

    // Estimate 10 seconds per request on average
    const estimatedSeconds = Math.max(0, (position - this.concurrentLimit + 1) * 10);
    return estimatedSeconds;
  }
}

// Export singleton instance
export const priorityQueue = new PriorityProcessingQueue();