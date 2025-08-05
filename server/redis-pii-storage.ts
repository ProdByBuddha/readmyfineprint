import type { 
  PIIStorageInterface, 
  DocumentCorrelationData, 
  CrossSessionCorrelation 
} from './pii-storage-interface';

// Dynamic import for ioredis to avoid dependency issues when not in use
let Redis: any;
try {
  Redis = require('ioredis');
} catch (error) {
  // ioredis not available - will throw error in constructor if Redis is attempted to be used
}

/**
 * Redis implementation of PII storage interface
 * Provides fast, persistent storage for PII correlation data
 */
export class RedisPIIStorage implements PIIStorageInterface {
  private redis: any;
  
  constructor(redisConfig?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  }) {
    if (!Redis) {
      throw new Error('ioredis package is required for Redis storage. Install it with: npm install ioredis');
    }
    
    this.redis = new Redis({
      host: redisConfig?.host || process.env.REDIS_HOST || 'localhost',
      port: redisConfig?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: redisConfig?.password || process.env.REDIS_PASSWORD,
      db: redisConfig?.db || parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
  }

  /**
   * Store document correlation data with Redis hash and sets for efficient queries
   */
  async storeDocumentCorrelation(
    sessionId: string,
    documentId: string,
    correlationData: Omit<DocumentCorrelationData, 'sessionId' | 'documentId'>
  ): Promise<void> {
    const key = `session:${sessionId}:doc:${documentId}`;
    const sessionKey = `session:${sessionId}:docs`;
    
    // Store full document data as hash
    const dataToStore = {
      ...correlationData,
      sessionId,
      documentId,
      timestamp: correlationData.timestamp.toISOString(),
      piiTypes: JSON.stringify(correlationData.piiTypes),
      detectionQuality: JSON.stringify(correlationData.detectionQuality),
      correlationIds: JSON.stringify(correlationData.correlationIds)
    };

    const pipeline = this.redis.pipeline();
    
    // Store document data
    pipeline.hmset(key, dataToStore);
    
    // Add to session document list
    pipeline.sadd(sessionKey, documentId);
    
    // Index correlation IDs for cross-session lookup
    for (const correlationId of correlationData.correlationIds) {
      pipeline.sadd(`correlation:${correlationId}`, `${sessionId}:${documentId}`);
    }
    
    // Set expiration (30 days)
    pipeline.expire(key, 30 * 24 * 60 * 60);
    pipeline.expire(sessionKey, 30 * 24 * 60 * 60);
    
    await pipeline.exec();
    
    console.log(`📦 Stored document correlation: ${sessionId}:${documentId}`);
  }

  /**
   * Get the most recent document correlation data for a session
   */
  async getSessionCorrelation(sessionId: string): Promise<DocumentCorrelationData | null> {
    const sessionKey = `session:${sessionId}:docs`;
    const documentIds = await this.redis.smembers(sessionKey);
    
    if (documentIds.length === 0) {
      return null;
    }
    
    // Get the most recent document (they're stored with timestamps)
    const documents = await Promise.all(
      documentIds.map(async (docId: string) => {
        const key = `session:${sessionId}:doc:${docId}`;
        const data = await this.redis.hgetall(key);
        if (Object.keys(data).length === 0) return null;
        
        return {
          sessionId: data.sessionId,
          documentId: data.documentId,
          correlationIds: JSON.parse(data.correlationIds),
          documentFingerprint: data.documentFingerprint,
          timestamp: new Date(data.timestamp),
          piiTypes: JSON.parse(data.piiTypes),
          riskScore: parseFloat(data.riskScore),
          detectionQuality: JSON.parse(data.detectionQuality)
        } as DocumentCorrelationData;
      })
    );
    
    const validDocuments = documents.filter((doc: any) => doc !== null) as DocumentCorrelationData[];
    return validDocuments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] || null;
  }

  /**
   * Get all documents in a session
   */
  async getSessionDocuments(sessionId: string): Promise<DocumentCorrelationData[]> {
    const sessionKey = `session:${sessionId}:docs`;
    const documentIds = await this.redis.smembers(sessionKey);
    
    if (documentIds.length === 0) {
      return [];
    }
    
    const documents = await Promise.all(
      documentIds.map(async (docId: string) => {
        const key = `session:${sessionId}:doc:${docId}`;
        const data = await this.redis.hgetall(key);
        if (Object.keys(data).length === 0) return null;
        
        return {
          sessionId: data.sessionId,
          documentId: data.documentId,
          correlationIds: JSON.parse(data.correlationIds),
          documentFingerprint: data.documentFingerprint,
          timestamp: new Date(data.timestamp),
          piiTypes: JSON.parse(data.piiTypes),
          riskScore: parseFloat(data.riskScore),
          detectionQuality: JSON.parse(data.detectionQuality)
        } as DocumentCorrelationData;
      })
    );
    
    return documents.filter((doc: any) => doc !== null) as DocumentCorrelationData[];
  }

  /**
   * Find documents with shared correlation IDs across different sessions
   */
  async findCrossSessionCorrelations(
    correlationIds: string[],
    excludeSessionId?: string
  ): Promise<CrossSessionCorrelation[]> {
    const correlations: CrossSessionCorrelation[] = [];
    
    for (const correlationId of correlationIds) {
      const documentsWithCorrelation = await this.redis.smembers(`correlation:${correlationId}`);
      
      for (const docRef of documentsWithCorrelation) {
        const [sessionId, documentId] = docRef.split(':');
        
        if (excludeSessionId && sessionId === excludeSessionId) {
          continue;
        }
        
        // Check if this correlation already exists in our results
        const existingCorrelation = correlations.find(
          c => c.sessionId === sessionId && c.documentId === documentId
        );
        
        if (existingCorrelation) {
          existingCorrelation.sharedCorrelationIds.push(correlationId);
          existingCorrelation.correlationStrength = 
            existingCorrelation.sharedCorrelationIds.length / correlationIds.length;
        } else {
          correlations.push({
            sessionId,
            documentId,
            sharedCorrelationIds: [correlationId],
            correlationStrength: 1 / correlationIds.length,
            analysisTimestamp: new Date()
          });
        }
      }
    }
    
    return correlations.sort((a, b) => b.correlationStrength - a.correlationStrength);
  }

  /**
   * Clear all data for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}:docs`;
    const documentIds = await this.redis.smembers(sessionKey);
    
    const pipeline = this.redis.pipeline();
    
    // Remove session documents list
    pipeline.del(sessionKey);
    
    // Remove each document and its correlation indexes
    for (const docId of documentIds) {
      const docKey = `session:${sessionId}:doc:${docId}`;
      const docData = await this.redis.hgetall(docKey);
      
      if (docData.correlationIds) {
        const correlationIds = JSON.parse(docData.correlationIds);
        for (const correlationId of correlationIds) {
          pipeline.srem(`correlation:${correlationId}`, `${sessionId}:${docId}`);
        }
      }
      
      pipeline.del(docKey);
    }
    
    await pipeline.exec();
    console.log(`🗑️ Cleared session: ${sessionId}`);
  }

  /**
   * Get correlation analytics for forensic reporting
   */
  async getCorrelationAnalytics(
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalSessions: number;
    totalDocuments: number;
    crossSessionCorrelations: number;
    riskDistribution: Record<string, number>;
  }> {
    // Get all session keys
    const sessionKeys = await this.redis.keys('session:*:docs');
    const totalSessions = sessionKeys.length;
    
    let totalDocuments = 0;
    let crossSessionCorrelations = 0;
    const riskDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0
    };
    
    // Analyze each session
    for (const sessionKey of sessionKeys) {
      const sessionId = sessionKey.split(':')[1];
      const documents = await this.getSessionDocuments(sessionId);
      
      totalDocuments += documents.length;
      
      // Count risk distribution
      for (const doc of documents) {
        if (timeRange) {
          if (doc.timestamp < timeRange.start || doc.timestamp > timeRange.end) {
            continue;
          }
        }
        
        if (doc.riskScore < 0.3) {
          riskDistribution.low++;
        } else if (doc.riskScore < 0.7) {
          riskDistribution.medium++;
        } else {
          riskDistribution.high++;
        }
      }
    }
    
    // Count cross-session correlations (simplified)
    const correlationKeys = await this.redis.keys('correlation:*');
    for (const corrKey of correlationKeys) {
      const docs = await this.redis.smembers(corrKey);
      const uniqueSessions = new Set(docs.map((doc: string) => doc.split(':')[0]));
      if (uniqueSessions.size > 1) {
        crossSessionCorrelations++;
      }
    }
    
    return {
      totalSessions,
      totalDocuments,
      crossSessionCorrelations,
      riskDistribution
    };
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}