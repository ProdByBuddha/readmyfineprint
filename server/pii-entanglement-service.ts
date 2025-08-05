import { piiHashingService, type HashedPIIMatch } from './pii-hashing-service';
import type { EnhancedPIIDetectionResult } from './enhanced-pii-detection';
import type { PIIStorageInterface, DocumentCorrelationData } from './pii-storage-interface';
import { PostgreSQLPIIStorage } from './postgresql-pii-storage';
import { getDatabaseConfig } from './database-config';

/**
 * PII Cross-Document Correlation Service
 * 
 * This service manages secure PII correlation across document sessions
 * using Argon2 hashes to enable forensic analysis without exposing actual PII.
 * Uses persistent storage for scalable multi-session analysis.
 */
export class PIICorrelationService {
  
  // Database storage interface for persistent session tracking
  private storage: PIIStorageInterface;

  constructor(storage?: PIIStorageInterface) {
    if (storage) {
      this.storage = storage;
    } else {
      // Auto-configure based on environment
      const config = getDatabaseConfig();
      if (config.type === 'postgresql') {
        this.storage = new PostgreSQLPIIStorage(config.postgresql);
      } else {
        // Dynamically import Redis storage to avoid dependency issues
        throw new Error('Redis storage requires ioredis package to be installed. Please install ioredis or use PostgreSQL (PII_DB_TYPE=postgresql)');
      }
    }
  }

  /**
   * Store PII correlation data for a document session with enhanced detection metrics
   */
  async storeDocumentCorrelation(
    sessionId: string, 
    documentId: string, 
    hashedMatches: HashedPIIMatch[],
    detectionMetrics?: EnhancedPIIDetectionResult['detectionMetrics']
  ): Promise<void> {
    if (hashedMatches.length === 0) {
      console.log(`📄 No PII correlation to store for document: ${documentId}`);
      return;
    }

    const analytics = piiHashingService.createPIIAnalyticsSummary(hashedMatches);
    
    const correlationData = {
      correlationIds: analytics.entanglementIds, // Rename for consistency
      documentFingerprint: analytics.documentPIIFingerprint,
      timestamp: new Date(),
      piiTypes: analytics.piiTypes,
      riskScore: analytics.riskScore,
      detectionQuality: detectionMetrics || {
        totalMatches: hashedMatches.length,
        highConfidenceMatches: hashedMatches.length,
        falsePositiveRisk: 0.1,
        coverageConfidence: 0.8
      }
    };

    await this.storage.storeDocumentCorrelation(sessionId, documentId, correlationData);
    
    console.log(`🔗 Stored PII correlation for session ${sessionId}:`);
    console.log(`   - Document: ${documentId}`);
    console.log(`   - Correlation IDs: ${analytics.entanglementIds.length}`);
    console.log(`   - Document Fingerprint: ${analytics.documentPIIFingerprint.substring(0, 16)}...`);
    console.log(`   - Risk Score: ${analytics.riskScore}`);
    console.log(`   - Detection Quality: ${(correlationData.detectionQuality.coverageConfidence * 100).toFixed(1)}% confidence, ${(correlationData.detectionQuality.falsePositiveRisk * 100).toFixed(1)}% false positive risk`);
  }

  /**
   * Check if a new document shares PII with previous documents in the session
   */
  async checkCrossDocumentCorrelation(
    sessionId: string, 
    newDocumentMatches: HashedPIIMatch[]
  ): Promise<{
    hasSharedPII: boolean;
    sharedCorrelationIds: string[];
    correlationStrength: number;
    previousDocument?: string;
    analysisDetails: {
      newDocumentCorrelations: string[];
      previousDocumentCorrelations: string[];
      sharedTypes: string[];
      riskEscalation: boolean;
    };
  }> {
    const existingData = await this.storage.getSessionCorrelation(sessionId);
    
    if (!existingData || newDocumentMatches.length === 0) {
      return {
        hasSharedPII: false,
        sharedCorrelationIds: [],
        correlationStrength: 0,
        analysisDetails: {
          newDocumentCorrelations: [],
          previousDocumentCorrelations: [],
          sharedTypes: [],
          riskEscalation: false
        }
      };
    }

    const newAnalytics = piiHashingService.createPIIAnalyticsSummary(newDocumentMatches);
    const correlationResult = piiHashingService.checkPIIEntanglement(
      existingData.correlationIds,
      newAnalytics.entanglementIds
    );

    // Determine shared PII types
    const sharedTypes: string[] = [];
    for (const [type, count] of Object.entries(newAnalytics.piiTypes)) {
      if (existingData.piiTypes[type] && count > 0) {
        sharedTypes.push(type);
      }
    }

    // Check for risk escalation (higher risk in new document)
    const riskEscalation = newAnalytics.riskScore > existingData.riskScore;

    const analysisDetails = {
      newDocumentCorrelations: newAnalytics.entanglementIds,
      previousDocumentCorrelations: existingData.correlationIds,
      sharedTypes,
      riskEscalation
    };

    if (correlationResult.hasSharedPII) {
      console.log(`🚨 Cross-document PII correlation detected in session ${sessionId}:`);
      console.log(`   - Previous document: ${existingData.documentId}`);
      console.log(`   - Shared correlation IDs: ${correlationResult.sharedEntanglementIds.length}`);
      console.log(`   - Correlation strength: ${(correlationResult.entanglementStrength * 100).toFixed(1)}%`);
      console.log(`   - Shared PII types: ${sharedTypes.join(', ') || 'None'}`);
      console.log(`   - Risk escalation: ${riskEscalation ? 'YES' : 'No'}`);
    } else {
      console.log(`✅ No cross-document PII correlation found in session ${sessionId}`);
    }

    return {
      hasSharedPII: correlationResult.hasSharedPII,
      sharedCorrelationIds: correlationResult.sharedEntanglementIds,
      correlationStrength: correlationResult.entanglementStrength,
      previousDocument: existingData.documentId,
      analysisDetails
    };
  }

  /**
   * Get current session correlation summary
   */
  async getSessionCorrelationSummary(sessionId: string): Promise<{
    hasCorrelations: boolean;
    documentCount: number;
    totalCorrelations: number;
    riskScore: number;
    piiTypesFound: string[];
    documentFingerprint?: string;
  } | null> {
    const documents = await this.storage.getSessionDocuments(sessionId);
    
    if (documents.length === 0) {
      return null;
    }

    // Calculate aggregate statistics for all documents in session
    const totalCorrelations = documents.reduce((sum, doc) => sum + doc.correlationIds.length, 0);
    const averageRiskScore = documents.reduce((sum, doc) => sum + doc.riskScore, 0) / documents.length;
    const allPiiTypes = new Set<string>();
    
    documents.forEach(doc => {
      Object.keys(doc.piiTypes).forEach(type => allPiiTypes.add(type));
    });

    return {
      hasCorrelations: totalCorrelations > 0,
      documentCount: documents.length,
      totalCorrelations,
      riskScore: averageRiskScore,
      piiTypesFound: Array.from(allPiiTypes),
      documentFingerprint: documents[documents.length - 1]?.documentFingerprint
    };
  }

  /**
   * Clear correlation data for a session (for cleanup)
   */
  async clearSessionCorrelations(sessionId: string): Promise<void> {
    await this.storage.clearSession(sessionId);
    console.log(`🧹 Cleared PII correlation data for session ${sessionId}`);
  }

  /**
   * Get analytics for forensic reporting
   */
  async getCorrelationAnalytics(timeRange?: { start: Date; end: Date }) {
    return await this.storage.getCorrelationAnalytics(timeRange);
  }

  /**
   * Create a forensic analysis report for cross-session PII correlation
   * This enables security teams to track PII patterns without exposing actual data
   */
  async createForensicAnalysisReport(sessionIds: string[]): Promise<{
    reportId: string;
    timestamp: string;
    sessionCount: number;
    totalDocuments: number;
    crossSessionCorrelations: Array<{
      sessionPair: [string, string];
      sharedCorrelationIds: string[];
      correlationStrength: number;
      sharedPIITypes: string[];
    }>;
    aggregateRiskProfile: {
      averageRiskScore: number;
      highestRiskSession: string;
      mostCommonPIITypes: Record<string, number>;
      totalUniqueCorrelations: number;
    };
  }> {
    const reportId = `forensic_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Get session data from storage
    const sessionDataPromises = sessionIds.map(async (id) => {
      const docs = await this.storage.getSessionDocuments(id);
      return { id, documents: docs };
    });
    const sessionData = await Promise.all(sessionDataPromises);
    const validSessions = sessionData.filter(s => s.documents.length > 0);

    // Check for cross-session correlations
    const crossSessionCorrelations: Array<{
      sessionPair: [string, string];
      sharedCorrelationIds: string[];
      correlationStrength: number;
      sharedPIITypes: string[];
    }> = [];

    for (let i = 0; i < validSessions.length; i++) {
      for (let j = i + 1; j < validSessions.length; j++) {
        const session1 = validSessions[i];
        const session2 = validSessions[j];
        
        // Get all correlation IDs from each session
        const session1CorrelationIds = session1.documents.flatMap(doc => doc.correlationIds);
        const session2CorrelationIds = session2.documents.flatMap(doc => doc.correlationIds);
        
        const correlation = piiHashingService.checkPIIEntanglement(
          session1CorrelationIds,
          session2CorrelationIds
        );

        if (correlation.hasSharedPII) {
          // Find shared PII types across all documents in both sessions
          const session1Types = new Set<string>();
          const session2Types = new Set<string>();
          
          session1.documents.forEach(doc => Object.keys(doc.piiTypes).forEach(type => session1Types.add(type)));
          session2.documents.forEach(doc => Object.keys(doc.piiTypes).forEach(type => session2Types.add(type)));
          
          const sharedPIITypes = Array.from(session1Types).filter(type => session2Types.has(type));

          crossSessionCorrelations.push({
            sessionPair: [session1.id, session2.id],
            sharedCorrelationIds: correlation.sharedEntanglementIds,
            correlationStrength: correlation.entanglementStrength,
            sharedPIITypes
          });
        }
      }
    }

    // Calculate aggregate risk profile
    const allDocuments = validSessions.flatMap(s => s.documents);
    const allRiskScores = allDocuments.map(doc => doc.riskScore);
    const averageRiskScore = allRiskScores.length > 0 
      ? allRiskScores.reduce((a, b) => a + b, 0) / allRiskScores.length 
      : 0;
    
    // Find session with highest average risk score
    let highestRiskSession = '';
    let highestRisk = 0;
    for (const session of validSessions) {
      const sessionRisk = session.documents.reduce((sum, doc) => sum + doc.riskScore, 0) / session.documents.length;
      if (sessionRisk > highestRisk) {
        highestRisk = sessionRisk;
        highestRiskSession = session.id;
      }
    }

    // Aggregate PII types across all sessions
    const mostCommonPIITypes: Record<string, number> = {};
    for (const session of validSessions) {
      for (const doc of session.documents) {
        for (const [type, count] of Object.entries(doc.piiTypes)) {
          mostCommonPIITypes[type] = (mostCommonPIITypes[type] || 0) + count;
        }
      }
    }

    // Count unique correlations across all sessions
    const allCorrelationIds = allDocuments.flatMap(doc => doc.correlationIds);
    const totalUniqueCorrelations = new Set(allCorrelationIds).size;

    const report = {
      reportId,
      timestamp: new Date().toISOString(),
      sessionCount: validSessions.length,
      totalDocuments: allDocuments.length,
      crossSessionCorrelations,
      aggregateRiskProfile: {
        averageRiskScore,
        highestRiskSession,
        mostCommonPIITypes,
        totalUniqueCorrelations
      }
    };

    console.log(`📊 Generated forensic analysis report ${reportId}:`);
    console.log(`   - Sessions analyzed: ${validSessions.length}`);
    console.log(`   - Cross-session correlations: ${crossSessionCorrelations.length}`);
    console.log(`   - Average risk score: ${averageRiskScore.toFixed(1)}`);
    console.log(`   - Unique correlations: ${totalUniqueCorrelations}`);

    return report;
  }
}

// Create singleton instance for global use
export const piiCorrelationService = new PIICorrelationService();

// Backward compatibility alias (deprecated - use piiCorrelationService)
export const piiEntanglementService = piiCorrelationService;