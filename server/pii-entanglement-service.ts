import { piiHashingService, type HashedPIIMatch } from './pii-hashing-service';
import type { EnhancedPIIDetectionResult } from './enhanced-pii-detection';

/**
 * PII Entanglement Service for Cross-Document Analysis
 * 
 * This service manages secure PII correlation across document sessions
 * using Argon2 hashes to enable forensic analysis without exposing actual PII
 */
export class PIIEntanglementService {
  
  // In-memory store for current session - in production this would be Redis/database
  private sessionEntanglements = new Map<string, {
    documentId: string;
    entanglementIds: string[];
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
  }>();

  /**
   * Store PII entanglement data for a document session with enhanced detection metrics
   */
  storeDocumentEntanglement(
    sessionId: string, 
    documentId: string, 
    hashedMatches: HashedPIIMatch[],
    detectionMetrics?: EnhancedPIIDetectionResult['detectionMetrics']
  ): void {
    if (hashedMatches.length === 0) {
      console.log(`📄 No PII entanglement to store for document: ${documentId}`);
      return;
    }

    const analytics = piiHashingService.createPIIAnalyticsSummary(hashedMatches);
    
    const entanglementData = {
      documentId,
      entanglementIds: analytics.entanglementIds,
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

    this.sessionEntanglements.set(sessionId, entanglementData);
    
    console.log(`🔗 Stored PII entanglement for session ${sessionId}:`);
    console.log(`   - Document: ${documentId}`);
    console.log(`   - Entanglement IDs: ${analytics.entanglementIds.length}`);
    console.log(`   - Document Fingerprint: ${analytics.documentPIIFingerprint.substring(0, 16)}...`);
    console.log(`   - Risk Score: ${analytics.riskScore}`);
    console.log(`   - Detection Quality: ${(entanglementData.detectionQuality.coverageConfidence * 100).toFixed(1)}% confidence, ${(entanglementData.detectionQuality.falsePositiveRisk * 100).toFixed(1)}% false positive risk`);
  }

  /**
   * Check if a new document shares PII with previous documents in the session
   */
  checkCrossDocumentEntanglement(
    sessionId: string, 
    newDocumentMatches: HashedPIIMatch[]
  ): {
    hasSharedPII: boolean;
    sharedEntanglementIds: string[];
    entanglementStrength: number;
    previousDocument?: string;
    analysisDetails: {
      newDocumentEntanglements: string[];
      previousDocumentEntanglements: string[];
      sharedTypes: string[];
      riskEscalation: boolean;
    };
  } {
    const existingData = this.sessionEntanglements.get(sessionId);
    
    if (!existingData || newDocumentMatches.length === 0) {
      return {
        hasSharedPII: false,
        sharedEntanglementIds: [],
        entanglementStrength: 0,
        analysisDetails: {
          newDocumentEntanglements: [],
          previousDocumentEntanglements: [],
          sharedTypes: [],
          riskEscalation: false
        }
      };
    }

    const newAnalytics = piiHashingService.createPIIAnalyticsSummary(newDocumentMatches);
    const entanglementResult = piiHashingService.checkPIIEntanglement(
      existingData.entanglementIds,
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
      newDocumentEntanglements: newAnalytics.entanglementIds,
      previousDocumentEntanglements: existingData.entanglementIds,
      sharedTypes,
      riskEscalation
    };

    if (entanglementResult.hasSharedPII) {
      console.log(`🚨 Cross-document PII entanglement detected in session ${sessionId}:`);
      console.log(`   - Previous document: ${existingData.documentId}`);
      console.log(`   - Shared entanglement IDs: ${entanglementResult.sharedEntanglementIds.length}`);
      console.log(`   - Entanglement strength: ${(entanglementResult.entanglementStrength * 100).toFixed(1)}%`);
      console.log(`   - Shared PII types: ${sharedTypes.join(', ') || 'None'}`);
      console.log(`   - Risk escalation: ${riskEscalation ? 'YES' : 'No'}`);
    } else {
      console.log(`✅ No cross-document PII entanglement found in session ${sessionId}`);
    }

    return {
      hasSharedPII: entanglementResult.hasSharedPII,
      sharedEntanglementIds: entanglementResult.sharedEntanglementIds,
      entanglementStrength: entanglementResult.entanglementStrength,
      previousDocument: existingData.documentId,
      analysisDetails
    };
  }

  /**
   * Get current session entanglement summary
   */
  getSessionEntanglementSummary(sessionId: string): {
    hasEntanglements: boolean;
    documentCount: number;
    totalEntanglements: number;
    riskScore: number;
    piiTypesFound: string[];
    documentFingerprint?: string;
  } | null {
    const existingData = this.sessionEntanglements.get(sessionId);
    
    if (!existingData) {
      return null;
    }

    return {
      hasEntanglements: existingData.entanglementIds.length > 0,
      documentCount: 1, // Currently tracking one document per session - could be extended
      totalEntanglements: existingData.entanglementIds.length,
      riskScore: existingData.riskScore,
      piiTypesFound: Object.keys(existingData.piiTypes),
      documentFingerprint: existingData.documentFingerprint
    };
  }

  /**
   * Clear entanglement data for a session (for cleanup)
   */
  clearSessionEntanglements(sessionId: string): void {
    const existed = this.sessionEntanglements.delete(sessionId);
    if (existed) {
      console.log(`🧹 Cleared PII entanglement data for session ${sessionId}`);
    }
  }

  /**
   * Get all active sessions with entanglements (for monitoring/debugging)
   */
  getActiveEntanglementSessions(): string[] {
    return Array.from(this.sessionEntanglements.keys());
  }

  /**
   * Create a forensic analysis report for cross-session PII correlation
   * This enables security teams to track PII patterns without exposing actual data
   */
  createForensicAnalysisReport(sessionIds: string[]): {
    reportId: string;
    timestamp: string;
    sessionCount: number;
    totalDocuments: number;
    crossSessionEntanglements: Array<{
      sessionPair: [string, string];
      sharedEntanglementIds: string[];
      entanglementStrength: number;
      sharedPIITypes: string[];
    }>;
    aggregateRiskProfile: {
      averageRiskScore: number;
      highestRiskSession: string;
      mostCommonPIITypes: Record<string, number>;
      totalUniqueEntanglements: number;
    };
  } {
    const reportId = `forensic_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sessionData = sessionIds
      .map(id => ({ id, data: this.sessionEntanglements.get(id) }))
      .filter(item => item.data);

    // Check for cross-session entanglements
    const crossSessionEntanglements: Array<{
      sessionPair: [string, string];
      sharedEntanglementIds: string[];
      entanglementStrength: number;
      sharedPIITypes: string[];
    }> = [];

    for (let i = 0; i < sessionData.length; i++) {
      for (let j = i + 1; j < sessionData.length; j++) {
        const session1 = sessionData[i];
        const session2 = sessionData[j];
        
        if (session1.data && session2.data) {
          const entanglement = piiHashingService.checkPIIEntanglement(
            session1.data.entanglementIds,
            session2.data.entanglementIds
          );

          if (entanglement.hasSharedPII) {
            // Find shared PII types
            const sharedPIITypes: string[] = [];
            for (const type of Object.keys(session1.data.piiTypes)) {
              if (session2.data.piiTypes[type]) {
                sharedPIITypes.push(type);
              }
            }

            crossSessionEntanglements.push({
              sessionPair: [session1.id, session2.id],
              sharedEntanglementIds: entanglement.sharedEntanglementIds,
              entanglementStrength: entanglement.entanglementStrength,
              sharedPIITypes
            });
          }
        }
      }
    }

    // Calculate aggregate risk profile
    const allRiskScores = sessionData.map(s => s.data!.riskScore);
    const averageRiskScore = allRiskScores.length > 0 
      ? allRiskScores.reduce((a, b) => a + b, 0) / allRiskScores.length 
      : 0;
    
    const highestRiskSession = sessionData.reduce((highest, current) => 
      current.data!.riskScore > (highest.data?.riskScore || 0) ? current : highest
    ).id;

    // Aggregate PII types across all sessions
    const mostCommonPIITypes: Record<string, number> = {};
    for (const session of sessionData) {
      if (session.data) {
        for (const [type, count] of Object.entries(session.data.piiTypes)) {
          mostCommonPIITypes[type] = (mostCommonPIITypes[type] || 0) + count;
        }
      }
    }

    // Count unique entanglements across all sessions
    const allEntanglementIds = sessionData.flatMap(s => s.data?.entanglementIds || []);
    const totalUniqueEntanglements = new Set(allEntanglementIds).size;

    const report = {
      reportId,
      timestamp: new Date().toISOString(),
      sessionCount: sessionData.length,
      totalDocuments: sessionData.length, // Currently 1:1 mapping
      crossSessionEntanglements,
      aggregateRiskProfile: {
        averageRiskScore,
        highestRiskSession,
        mostCommonPIITypes,
        totalUniqueEntanglements
      }
    };

    console.log(`📊 Generated forensic analysis report ${reportId}:`);
    console.log(`   - Sessions analyzed: ${sessionData.length}`);
    console.log(`   - Cross-session entanglements: ${crossSessionEntanglements.length}`);
    console.log(`   - Average risk score: ${averageRiskScore.toFixed(1)}`);
    console.log(`   - Unique entanglements: ${totalUniqueEntanglements}`);

    return report;
  }
}

// Export singleton instance
export const piiEntanglementService = new PIIEntanglementService();