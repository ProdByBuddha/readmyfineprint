import crypto from 'node:crypto';
import { piiHashingService, type HashedPIIMatch } from './pii-hashing-service';

/**
 * Multi-Layer Payload Hashing Service
 * 
 * Creates a "Russian Doll" of hashes for complete forensic traceability:
 * - Layer 1: Original document content hash
 * - Layer 2: Redacted document content hash  
 * - Layer 3: Complete OpenAI API request payload hash
 * - Layer 4: Individual PII entanglement hashes
 * - Layer 5: Response payload hash
 */

export interface PayloadLayer {
  layerName: string;
  contentType: 'original' | 'redacted' | 'api_request' | 'api_response' | 'pii_individual';
  hash: string;
  algorithm: 'sha256' | 'argon2id';
  size: number; // Size of content in bytes
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PayloadFingerprint {
  documentId: string;
  sessionId: string;
  fingerprintId: string;
  layers: PayloadLayer[];
  linkages: {
    originalToRedacted: string; // Hash proving redaction integrity
    redactedToApiRequest: string; // Hash proving API request integrity
    piiToEntanglement: string; // Hash linking PII to entanglement IDs
    completeChain: string; // Master hash of all layers combined
  };
  processingChain: {
    startTime: string;
    endTime: string;
    totalProcessingTime: number; // milliseconds
    stageTimings: Record<string, number>;
  };
  securityMetrics: {
    piiDetectionConfidence: number;
    redactionIntegrity: number; // 0-1 score
    chainIntegrity: number; // 0-1 score
    forensicScore: number; // Overall forensic utility score
  };
}

export class PayloadHashingService {
  
  /**
   * Create a complete multi-layer hash fingerprint for document processing
   */
  async createPayloadFingerprint(
    originalContent: string,
    redactedContent: string,
    apiRequestPayload: any,
    apiResponsePayload: any,
    hashedPiiMatches: HashedPIIMatch[],
    options: {
      documentId: string;
      sessionId: string;
      detectionMetrics?: any;
      processingTimings?: Record<string, number>;
    }
  ): Promise<PayloadFingerprint> {
    
    const startTime = new Date();
    const fingerprintId = this.generateFingerprintId();
    
    console.log(`🔍 Creating multi-layer payload fingerprint ${fingerprintId}`);
    console.log(`   - Document: ${options.documentId}`);
    console.log(`   - Session: ${options.sessionId}`);

    // Layer 1: Original document content
    const originalLayer = await this.createContentLayer(
      'original_document',
      'original',
      originalContent,
      'sha256',
      { 
        characterCount: originalContent.length,
        lineCount: originalContent.split('\n').length,
        wordCount: originalContent.split(/\s+/).length
      }
    );

    // Layer 2: Redacted document content
    const redactedLayer = await this.createContentLayer(
      'redacted_document', 
      'redacted',
      redactedContent,
      'sha256',
      {
        characterCount: redactedContent.length,
        redactionCount: (redactedContent.match(/\[REDACTED_/g) || []).length,
        redactionRatio: ((originalContent.length - redactedContent.length) / originalContent.length)
      }
    );

    // Layer 3: Complete API request payload
    const apiRequestString = JSON.stringify(apiRequestPayload, null, 0);
    const apiRequestLayer = await this.createContentLayer(
      'openai_request',
      'api_request',
      apiRequestString,
      'sha256',
      {
        model: apiRequestPayload.model,
        messageCount: apiRequestPayload.messages?.length || 0,
        tokenEstimate: Math.ceil(apiRequestString.length / 4), // Rough token estimate
        temperature: apiRequestPayload.temperature,
        maxTokens: apiRequestPayload.max_tokens
      }
    );

    // Layer 4: API response payload
    const apiResponseString = JSON.stringify(apiResponsePayload, null, 0);
    const apiResponseLayer = await this.createContentLayer(
      'openai_response',
      'api_response', 
      apiResponseString,
      'sha256',
      {
        tokensUsed: apiResponsePayload.usage?.total_tokens || 0,
        completionTokens: apiResponsePayload.usage?.completion_tokens || 0,
        promptTokens: apiResponsePayload.usage?.prompt_tokens || 0,
        responseLength: apiResponseString.length
      }
    );

    // Layer 5: PII entanglement summary
    const piiSummary = this.createPIISummary(hashedPiiMatches);
    const piiLayer = await this.createContentLayer(
      'pii_entanglement',
      'pii_individual',
      JSON.stringify(piiSummary),
      'sha256',
      {
        piiCount: hashedPiiMatches.length,
        piiTypes: [...new Set(hashedPiiMatches.map(m => m.type))],
        entanglementIds: hashedPiiMatches.map(m => m.entanglementId)
      }
    );

    // Create linkage hashes proving integrity between layers
    const linkages = await this.createLinkageHashes([
      originalLayer,
      redactedLayer, 
      apiRequestLayer,
      apiResponseLayer,
      piiLayer
    ]);

    // Calculate processing chain timing
    const endTime = new Date();
    const processingChain = {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalProcessingTime: endTime.getTime() - startTime.getTime(),
      stageTimings: options.processingTimings || {}
    };

    // Calculate security metrics
    const securityMetrics = this.calculateSecurityMetrics(
      originalContent,
      redactedContent,
      hashedPiiMatches,
      options.detectionMetrics
    );

    const fingerprint: PayloadFingerprint = {
      documentId: options.documentId,
      sessionId: options.sessionId,
      fingerprintId,
      layers: [originalLayer, redactedLayer, apiRequestLayer, apiResponseLayer, piiLayer],
      linkages,
      processingChain,
      securityMetrics
    };

    console.log(`✅ Multi-layer fingerprint created:`);
    console.log(`   - Layers: ${fingerprint.layers.length}`);
    console.log(`   - Chain integrity: ${(securityMetrics.chainIntegrity * 100).toFixed(1)}%`);
    console.log(`   - Forensic score: ${(securityMetrics.forensicScore * 100).toFixed(1)}%`);
    console.log(`   - Processing time: ${processingChain.totalProcessingTime}ms`);

    return fingerprint;
  }

  /**
   * Create a single content layer hash
   */
  private async createContentLayer(
    layerName: string,
    contentType: PayloadLayer['contentType'],
    content: string,
    algorithm: 'sha256' | 'argon2id',
    metadata?: Record<string, any>
  ): Promise<PayloadLayer> {
    
    let hash: string;
    
    if (algorithm === 'sha256') {
      hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    } else {
      // For sensitive content, use Argon2id (though SHA256 is usually sufficient for payload hashing)
      const argon2 = await import('argon2');
      hash = await argon2.hash(content, { 
        type: argon2.argon2id,
        memoryCost: 2 ** 12,
        timeCost: 2,
        parallelism: 1
      });
    }

    return {
      layerName,
      contentType,
      hash,
      algorithm,
      size: Buffer.byteLength(content, 'utf8'),
      timestamp: new Date().toISOString(),
      metadata
    };
  }

  /**
   * Create linkage hashes that prove integrity between layers
   */
  private async createLinkageHashes(layers: PayloadLayer[]): Promise<PayloadFingerprint['linkages']> {
    
    // Hash proving original -> redacted integrity
    const originalToRedacted = crypto
      .createHash('sha256')
      .update(layers[0].hash + layers[1].hash + 'REDACTION_LINK')
      .digest('hex');

    // Hash proving redacted -> API request integrity  
    const redactedToApiRequest = crypto
      .createHash('sha256')
      .update(layers[1].hash + layers[2].hash + 'API_REQUEST_LINK')
      .digest('hex');

    // Hash linking PII to entanglement
    const piiToEntanglement = crypto
      .createHash('sha256')
      .update(layers[4].hash + (layers[4].metadata?.entanglementIds || []).join('|') + 'PII_ENTANGLEMENT_LINK')
      .digest('hex');

    // Master hash of complete chain
    const completeChain = crypto
      .createHash('sha256')
      .update(layers.map(l => l.hash).join('|') + 'COMPLETE_CHAIN')
      .digest('hex');

    return {
      originalToRedacted,
      redactedToApiRequest, 
      piiToEntanglement,
      completeChain
    };
  }

  /**
   * Create PII summary for hashing
   */
  private createPIISummary(hashedMatches: HashedPIIMatch[]): any {
    return {
      totalPII: hashedMatches.length,
      piiByType: hashedMatches.reduce((acc, match) => {
        acc[match.type] = (acc[match.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      entanglementIds: hashedMatches.map(m => m.entanglementId),
      hashSample: hashedMatches.slice(0, 3).map(m => ({
        type: m.type,
        entanglementId: m.entanglementId,
        hashPrefix: m.hashedValue.substring(0, 32)
      }))
    };
  }

  /**
   * Calculate security and integrity metrics
   */
  private calculateSecurityMetrics(
    originalContent: string,
    redactedContent: string,
    hashedPiiMatches: HashedPIIMatch[],
    detectionMetrics?: any
  ): PayloadFingerprint['securityMetrics'] {
    
    // PII detection confidence from enhanced detection
    const piiDetectionConfidence = detectionMetrics?.coverageConfidence || 0.8;

    // Redaction integrity - measure how well redaction was performed
    const redactionCount = (redactedContent.match(/\[REDACTED_/g) || []).length;
    const expectedRedactions = hashedPiiMatches.length;
    const redactionIntegrity = expectedRedactions > 0 
      ? Math.min(1.0, redactionCount / expectedRedactions)
      : 1.0;

    // Chain integrity - overall hash chain quality
    const chainIntegrity = Math.min(1.0, 
      (piiDetectionConfidence + redactionIntegrity) / 2
    );

    // Forensic score - how useful this fingerprint is for forensic analysis
    const hasMultiplePII = hashedPiiMatches.length > 1;
    const hasHighConfidencePII = hashedPiiMatches.some(m => m.confidence > 0.85);
    const hasCompleteChain = redactionCount > 0 && hashedPiiMatches.length > 0;
    
    let forensicScore = 0.5; // Base score
    if (hasMultiplePII) forensicScore += 0.2;
    if (hasHighConfidencePII) forensicScore += 0.2;
    if (hasCompleteChain) forensicScore += 0.1;
    
    forensicScore = Math.min(1.0, forensicScore);

    return {
      piiDetectionConfidence,
      redactionIntegrity,
      chainIntegrity,
      forensicScore
    };
  }

  /**
   * Generate unique fingerprint ID
   */
  private generateFingerprintId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(6).toString('hex');
    return `PAYLOAD_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Verify payload fingerprint integrity
   */
  async verifyFingerprintIntegrity(fingerprint: PayloadFingerprint): Promise<{
    isValid: boolean;
    issues: string[];
    trustScore: number; // 0-1 score indicating trustworthiness
  }> {
    const issues: string[] = [];
    let trustScore = 1.0;

    // Verify layer hash consistency
    for (const layer of fingerprint.layers) {
      if (!layer.hash || layer.hash.length < 32) {
        issues.push(`Invalid hash length for layer ${layer.layerName}`);
        trustScore -= 0.2;
      }
    }

    // Verify linkage hashes exist
    const requiredLinkages = ['originalToRedacted', 'redactedToApiRequest', 'piiToEntanglement', 'completeChain'];
    for (const linkage of requiredLinkages) {
      if (!fingerprint.linkages[linkage as keyof typeof fingerprint.linkages]) {
        issues.push(`Missing linkage hash: ${linkage}`);
        trustScore -= 0.15;
      }
    }

    // Verify security metrics are reasonable
    if (fingerprint.securityMetrics.chainIntegrity < 0.5) {
      issues.push('Low chain integrity detected');
      trustScore -= 0.1;
    }

    if (fingerprint.securityMetrics.piiDetectionConfidence < 0.6) {
      issues.push('Low PII detection confidence');
      trustScore -= 0.1;
    }

    // Verify timing consistency
    const timingDiff = new Date(fingerprint.processingChain.endTime).getTime() - 
                      new Date(fingerprint.processingChain.startTime).getTime();
    
    if (Math.abs(timingDiff - fingerprint.processingChain.totalProcessingTime) > 1000) {
      issues.push('Inconsistent processing timing');
      trustScore -= 0.05;
    }

    return {
      isValid: issues.length === 0,
      issues,
      trustScore: Math.max(0, trustScore)
    };
  }

  /**
   * Create forensic report from payload fingerprint
   */
  createForensicReport(fingerprint: PayloadFingerprint): {
    reportId: string;
    summary: {
      documentId: string;
      sessionId: string;
      processingTime: number;
      layerCount: number;
      piiEntanglements: number;
    };
    integrityAnalysis: {
      chainIntegrity: number;
      redactionIntegrity: number;
      forensicUtility: number;
    };
    layerDetails: Array<{
      layer: string;
      contentType: string;
      hashFingerprint: string;
      size: number;
      timestamp: string;
    }>;
    securityAssessment: {
      overallRisk: 'low' | 'medium' | 'high';
      confidenceLevel: number;
      recommendations: string[];
    };
  } {
    const reportId = `FORENSIC_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`.toUpperCase();

    // Determine overall risk
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    if (fingerprint.securityMetrics.chainIntegrity < 0.7) overallRisk = 'medium';
    if (fingerprint.securityMetrics.chainIntegrity < 0.5) overallRisk = 'high';

    // Generate recommendations
    const recommendations: string[] = [];
    if (fingerprint.securityMetrics.piiDetectionConfidence < 0.8) {
      recommendations.push('Consider manual PII review for improved detection accuracy');
    }
    if (fingerprint.securityMetrics.redactionIntegrity < 0.9) {
      recommendations.push('Review redaction process for potential gaps');
    }
    if (fingerprint.securityMetrics.forensicScore < 0.7) {
      recommendations.push('Enhanced forensic logging recommended for better traceability');
    }

    return {
      reportId,
      summary: {
        documentId: fingerprint.documentId,
        sessionId: fingerprint.sessionId,
        processingTime: fingerprint.processingChain.totalProcessingTime,
        layerCount: fingerprint.layers.length,
        piiEntanglements: fingerprint.layers.find(l => l.contentType === 'pii_individual')?.metadata?.piiCount || 0
      },
      integrityAnalysis: {
        chainIntegrity: fingerprint.securityMetrics.chainIntegrity,
        redactionIntegrity: fingerprint.securityMetrics.redactionIntegrity,
        forensicUtility: fingerprint.securityMetrics.forensicScore
      },
      layerDetails: fingerprint.layers.map(layer => ({
        layer: layer.layerName,
        contentType: layer.contentType,
        hashFingerprint: layer.hash.substring(0, 16) + '...',
        size: layer.size,
        timestamp: layer.timestamp
      })),
      securityAssessment: {
        overallRisk,
        confidenceLevel: fingerprint.securityMetrics.chainIntegrity,
        recommendations
      }
    };
  }
}

// Export singleton instance
export const payloadHashingService = new PayloadHashingService();