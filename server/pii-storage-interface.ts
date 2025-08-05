import type { HashedPIIMatch } from './pii-hashing-service';
import type { EnhancedPIIDetectionResult } from './enhanced-pii-detection';

/**
 * Document correlation data structure for persistent storage
 */
export interface DocumentCorrelationData {
  documentId: string;
  sessionId: string;
  correlationIds: string[];
  documentFingerprint: string;
  timestamp: Date;
  piiTypes: Record<string, number>;
  riskScore: number;
  detectionQuality: {
    totalMatches: number;
    highConfidenceMatches: number;
    falsePositiveRisk: number;
    coverageConfidence: number;
  };
}

/**
 * Cross-session correlation analysis result
 */
export interface CrossSessionCorrelation {
  sessionId: string;
  documentId: string;
  sharedCorrelationIds: string[];
  correlationStrength: number;
  analysisTimestamp: Date;
}

/**
 * Storage interface for PII correlation data
 */
export interface PIIStorageInterface {
  /**
   * Store document correlation data
   */
  storeDocumentCorrelation(
    sessionId: string,
    documentId: string,
    correlationData: Omit<DocumentCorrelationData, 'sessionId' | 'documentId'>
  ): Promise<void>;

  /**
   * Get document correlation data by session
   */
  getSessionCorrelation(sessionId: string): Promise<DocumentCorrelationData | null>;

  /**
   * Get all documents in a session
   */
  getSessionDocuments(sessionId: string): Promise<DocumentCorrelationData[]>;

  /**
   * Find documents with shared correlation IDs across sessions
   */
  findCrossSessionCorrelations(
    correlationIds: string[],
    excludeSessionId?: string
  ): Promise<CrossSessionCorrelation[]>;

  /**
   * Clear session data (for cleanup/testing)
   */
  clearSession(sessionId: string): Promise<void>;

  /**
   * Get analytics for forensic reporting
   */
  getCorrelationAnalytics(
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalSessions: number;
    totalDocuments: number;
    crossSessionCorrelations: number;
    riskDistribution: Record<string, number>;
  }>;
}