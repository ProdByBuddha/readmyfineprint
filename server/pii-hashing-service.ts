import {
  hashSSN,
  hashPhoneNumber,
  hashCreditCard,
  hashPersonalName,
  hashAddress,
  hashDateOfBirth,
  hashCustomPII,
  createPseudonymizedEmail
} from './argon2';
import crypto from 'node:crypto';

import type { PIIMatch } from './pii-detection';

/**
 * Enhanced PII Match with Argon2 hashing for secure entanglement
 */
export interface HashedPIIMatch extends PIIMatch {
  hashedValue: string; // Argon2 hash of the original value
  entanglementId: string; // Short ID derived from hash for cross-system correlation
}

/**
 * PII Hashing Service for Document Analysis
 * 
 * This service creates secure Argon2 hashes of detected PII to enable:
 * 1. Secure entanglement across document sessions and systems
 * 2. Privacy-preserving analytics and correlation
 * 3. Consistent redaction mapping across platforms
 * 4. Forensic analysis without exposing actual PII
 */
export class PIIHashingService {
  
  /**
   * Hash a single PII value based on its type using specialized Argon2 functions
   */
  async hashPIIValue(value: string, type: PIIMatch['type']): Promise<{ hash: string; entanglementId: string }> {
    let hash: string;
    
    try {
      switch (type) {
        case 'ssn':
          hash = await hashSSN(value);
          break;
        case 'email':
          hash = await createPseudonymizedEmail(value);
          break;
        case 'phone':
          hash = await hashPhoneNumber(value);
          break;
        case 'creditCard':
          hash = await hashCreditCard(value);
          break;
        case 'name':
          hash = await hashPersonalName(value);
          break;
        case 'address':
          hash = await hashAddress(value);
          break;
        case 'dob':
          hash = await hashDateOfBirth(value);
          break;
        case 'custom':
          hash = await hashCustomPII(value, 'custom');
          break;
        default:
          // Fallback to custom hashing for unknown types
          hash = await hashCustomPII(value, type);
      }
      
      // Create entanglement ID - short identifier derived from hash for correlation
      const entanglementId = this.createEntanglementId(hash, type);
      
      return { hash, entanglementId };
    } catch (error) {
      console.error(`Failed to hash PII value of type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Hash multiple PII matches for a document
   */
  async hashPIIMatches(matches: PIIMatch[]): Promise<HashedPIIMatch[]> {
    const hashedMatches: HashedPIIMatch[] = [];
    
    console.log(`🔐 Hashing ${matches.length} PII matches for secure entanglement`);
    
    for (const match of matches) {
      try {
        const { hash, entanglementId } = await this.hashPIIValue(match.value, match.type);
        
        const hashedMatch: HashedPIIMatch = {
          ...match,
          hashedValue: hash,
          entanglementId
        };
        
        hashedMatches.push(hashedMatch);
        
        console.log(`   ✅ ${match.type}: ${match.value.substring(0, 8)}... -> ${entanglementId}`);
      } catch (error) {
        console.error(`   ❌ Failed to hash ${match.type}: ${match.value}`, error);
        // Continue with other matches even if one fails
      }
    }
    
    console.log(`🔗 Created ${hashedMatches.length} secure entanglement hashes`);
    return hashedMatches;
  }

  /**
   * Create a short entanglement ID from the full Argon2 hash
   * This ID can be used for cross-system correlation without exposing the hash
   */
  private createEntanglementId(hash: string, type: string): string {
    // Extract the actual hash portion from Argon2 format
    // Argon2 format: $argon2id$v=19$m=4096,t=2,p=1$salt$hash
    const hashParts = hash.split('$');
    const actualHash = hashParts[hashParts.length - 1] || hash;
    
    // Create a shorter ID for correlation: type prefix + first 16 chars of hash
    const shortHash = actualHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const typePrefix = type.substring(0, 3).toUpperCase();
    
    return `${typePrefix}_${shortHash}`;
  }

  /**
   * Create secure redaction map with hashed values
   * This map stores both the placeholder -> original value mapping (for current session)
   * and placeholder -> hashed value mapping (for secure storage/analytics)
   */
  async createSecureRedactionMap(matches: HashedPIIMatch[]): Promise<{
    originalMap: Record<string, string>; // placeholder -> original value (session only)
    hashedMap: Record<string, string>;   // placeholder -> hashed value (persistable)
    entanglementMap: Record<string, string>; // placeholder -> entanglement ID (for correlation)
  }> {
    const originalMap: Record<string, string> = {};
    const hashedMap: Record<string, string> = {};
    const entanglementMap: Record<string, string> = {};
    
    for (const match of matches) {
      originalMap[match.placeholder] = match.value;
      hashedMap[match.placeholder] = match.hashedValue;
      entanglementMap[match.placeholder] = match.entanglementId;
    }
    
    return { originalMap, hashedMap, entanglementMap };
  }

  /**
   * Create analytics-safe summary of PII found in document
   * This summary can be safely stored for business intelligence without exposing PII
   */
  createPIIAnalyticsSummary(hashedMatches: HashedPIIMatch[]): {
    documentPIIFingerprint: string; // Unique fingerprint for this document's PII pattern
    piiTypes: Record<string, number>; // Count of each PII type found
    entanglementIds: string[]; // List of entanglement IDs for cross-document correlation
    riskScore: number; // 0-100 risk score based on PII types and counts
  } {
    // Create document fingerprint from all entanglement IDs
    const sortedIds = hashedMatches.map(m => m.entanglementId).sort();
    const combined = sortedIds.join('|');
    const documentPIIFingerprint = crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);
    
    // Count PII types
    const piiTypes: Record<string, number> = {};
    for (const match of hashedMatches) {
      piiTypes[match.type] = (piiTypes[match.type] || 0) + 1;
    }
    
    // Calculate risk score based on types of PII found
    const riskScore = this.calculatePIIRiskScore(piiTypes);
    
    // Extract entanglement IDs for correlation
    const entanglementIds = hashedMatches.map(m => m.entanglementId);
    
    return {
      documentPIIFingerprint,
      piiTypes,
      entanglementIds,
      riskScore
    };
  }

  /**
   * Calculate risk score based on types and counts of PII
   */
  private calculatePIIRiskScore(piiTypes: Record<string, number>): number {
    const typeWeights = {
      ssn: 30,         // Highest risk
      creditCard: 25,  // Very high risk
      dob: 20,         // High risk
      phone: 15,       // Medium-high risk
      email: 10,       // Medium risk
      address: 15,     // Medium-high risk
      name: 5,         // Lower risk (common in documents)
      custom: 10       // Medium risk
    };
    
    let totalScore = 0;
    let maxPossibleScore = 100;
    
    for (const [type, count] of Object.entries(piiTypes)) {
      const weight = typeWeights[type as keyof typeof typeWeights] || 10;
      // Score increases with count but with diminishing returns
      const typeScore = weight * Math.log(count + 1);
      totalScore += typeScore;
    }
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.round(totalScore));
  }

  /**
   * Create a combined hash from multiple entanglement IDs
   */
  private hashCombinedIds(ids: string[]): string {
    const combined = ids.join('|');
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);
  }

  /**
   * Check if two documents share PII based on entanglement IDs
   */
  checkPIIEntanglement(doc1EntanglementIds: string[], doc2EntanglementIds: string[]): {
    hasSharedPII: boolean;
    sharedEntanglementIds: string[];
    entanglementStrength: number; // 0-1 score representing how much PII is shared
  } {
    const sharedIds = doc1EntanglementIds.filter(id => doc2EntanglementIds.includes(id));
    const hasSharedPII = sharedIds.length > 0;
    
    // Calculate entanglement strength
    const totalUniqueIds = new Set([...doc1EntanglementIds, ...doc2EntanglementIds]).size;
    const entanglementStrength = totalUniqueIds > 0 ? sharedIds.length / totalUniqueIds : 0;
    
    return {
      hasSharedPII,
      sharedEntanglementIds: sharedIds,
      entanglementStrength
    };
  }

  /**
   * Generate secure audit log entry for PII processing
   */
  createPIIAuditEntry(documentId: string, hashedMatches: HashedPIIMatch[], sessionId?: string): {
    timestamp: string;
    documentId: string;
    sessionId?: string;
    piiProcessingSummary: {
      typesProcessed: string[];
      totalMatches: number;
      entanglementIds: string[];
      documentFingerprint: string;
    };
  } {
    const analytics = this.createPIIAnalyticsSummary(hashedMatches);
    
    return {
      timestamp: new Date().toISOString(),
      documentId,
      sessionId,
      piiProcessingSummary: {
        typesProcessed: Object.keys(analytics.piiTypes),
        totalMatches: hashedMatches.length,
        entanglementIds: analytics.entanglementIds,
        documentFingerprint: analytics.documentPIIFingerprint
      }
    };
  }
}

export const piiHashingService = new PIIHashingService();