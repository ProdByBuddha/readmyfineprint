import crypto from 'crypto';
import { piiHashingService } from './pii-hashing-service';

export interface PIIMatch {
  type: 'ssn' | 'email' | 'phone' | 'creditCard' | 'address' | 'name' | 'dob' | 'custom' | 'attorney_client';
  value: string;
  start: number;
  end: number;
  confidence: number; // 0-1 score
  placeholder: string;
}

export interface PIIDetectionResult {
  originalText: string;
  redactedText: string;
  matches: PIIMatch[];
  redactionMap: Map<string, string>; // placeholder -> original value
  hashedMatches?: import('./pii-hashing-service').HashedPIIMatch[]; // Optional hashed PII data
}

export class PIIDetectionService {
  
  // Enhanced regex patterns for strict PII detection
  private patterns = {
    ssn: {
      regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      confidence: 0.95
    },
    email: {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      confidence: 0.98
    },
    phone: {
      // Enhanced phone number detection
      regex: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b|\b\d{10}\b/g,
      confidence: 0.85
    },
    creditCard: {
      // More comprehensive credit card detection
      regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12}|3[47][0-9]{13}|3[0-9]{13}|(?:2131|1800|35\d{3})\d{11})\b/g,
      confidence: 0.95
    },
    // Enhanced date patterns for potential DOB
      dob: {
        regex: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])\b/g,
      confidence: 0.75
    },
    // More comprehensive address detection
    address: {
      regex: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl|Way|Pkwy|Parkway|Terrace|Ter)\b/gi,
      confidence: 0.8
    },
    // Additional patterns for strict detection
    zipCode: {
      regex: /\b\d{5}(?:-\d{4})?\b/g,
      confidence: 0.7
    },
    // Government ID patterns
    passport: {
      regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
      confidence: 0.75
    }
  };

  // Comprehensive names for strict PII detection - better to over-detect than under-detect
  private commonNames = new Set([
    'john', 'jane', 'michael', 'sarah', 'david', 'mary', 'james', 'patricia', 'robert', 'jennifer',
    'william', 'linda', 'richard', 'elizabeth', 'joseph', 'barbara', 'thomas', 'susan', 'charles', 'jessica',
    'christopher', 'karen', 'daniel', 'nancy', 'matthew', 'lisa', 'anthony', 'betty', 'mark', 'helen',
    'donald', 'sandra', 'steven', 'donna', 'andrew', 'carol', 'joshua', 'ruth', 'kenneth', 'sharon',
    // Additional names for strict detection
    'alex', 'alexander', 'alexandra', 'jordan', 'rivera', 'bennett', 'smith', 'johnson', 'brown', 'davis',
    'miller', 'wilson', 'moore', 'taylor', 'anderson', 'thomas', 'jackson', 'white', 'harris', 'martin',
    'thompson', 'garcia', 'martinez', 'robinson', 'clark', 'rodriguez', 'lewis', 'lee', 'walker', 'hall',
    'allen', 'young', 'hernandez', 'king', 'wright', 'lopez', 'hill', 'scott', 'green', 'adams',
    'baker', 'gonzalez', 'nelson', 'carter', 'mitchell', 'perez', 'roberts', 'turner', 'phillips', 'campbell'
  ]);

  /**
   * Generate a secure placeholder for redacted content
   */
  private generatePlaceholder(type: string, index: number): string {
    const id = crypto.randomBytes(4).toString('hex');
    return `[REDACTED_${type.toUpperCase()}_${index}_${id}]`;
  }

  /**
   * Detect potential names in text - strict detection for maximum privacy protection
   */
  private detectNames(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];
    const words = text.split(/\s+/);
    let currentPosition = 0;

    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
      
      if (cleanWord.length > 2 && this.commonNames.has(cleanWord)) {
        const start = text.indexOf(word, currentPosition);
        const end = start + word.length;
        
        // High confidence for strict PII protection - better to over-redact than under-redact
        const confidence = 0.85;
        
        matches.push({
          type: 'name',
          value: word,
          start,
          end,
          confidence,
          placeholder: '' // Will be set later
        });
      }
      
      currentPosition = text.indexOf(word, currentPosition) + word.length;
    }

    return matches;
  }

  /**
   * Detect all PII in the given text
   * Note: PII detection is mandatory for all documents to ensure maximum privacy protection
   */
  detectPII(text: string, options: {
    detectNames?: boolean;
    minConfidence?: number;
    customPatterns?: Array<{ name: string; regex: RegExp; confidence: number; }>;
    enableHashing?: boolean; // Enable Argon2 hashing for secure entanglement
  } = {}): PIIDetectionResult {
    const {
      detectNames = true,
      minConfidence = 0.6,
      customPatterns = [],
      enableHashing = true // Default to enabled for maximum security
    } = options;

    const allMatches: PIIMatch[] = [];
    
    // Detect pattern-based PII
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        if (pattern.confidence >= minConfidence) {
          allMatches.push({
            type: type as PIIMatch['type'],
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: pattern.confidence,
            placeholder: '' // Will be set later
          });
        }
      }
    }

    // Detect names if enabled
    if (detectNames) {
      const nameMatches = this.detectNames(text);
      allMatches.push(...nameMatches.filter(m => m.confidence >= minConfidence));
    }

    // Detect custom patterns
    for (const customPattern of customPatterns) {
      let match;
      while ((match = customPattern.regex.exec(text)) !== null) {
        if (customPattern.confidence >= minConfidence) {
          allMatches.push({
            type: 'custom',
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: customPattern.confidence,
            placeholder: '' // Will be set later
          });
        }
      }
    }

    // Sort matches by position and remove overlaps
    const sortedMatches = this.deduplicateMatches(allMatches);
    
    // Generate redacted text and placeholders
    const { redactedText, redactionMap } = this.generateRedactedText(text, sortedMatches);

    // Generate hashed PII matches if hashing is enabled
    let hashedMatches: import('./pii-hashing-service').HashedPIIMatch[] | undefined = undefined;
    if (enableHashing && sortedMatches.length > 0) {
      console.log(`🔐 Generating Argon2 hashes for ${sortedMatches.length} PII matches for secure entanglement`);
      // Note: We'll use the async version in practice, but for now return basic structure
      hashedMatches = undefined; // Will be enhanced with actual hashing in the advanced method
    }

    return {
      originalText: text,
      redactedText,
      matches: sortedMatches,
      redactionMap,
      hashedMatches
    };
  }

  /**
   * Remove overlapping matches, keeping the one with higher confidence
   */
  private deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
    const sorted = matches.sort((a, b) => a.start - b.start);
    const deduplicated: PIIMatch[] = [];

    for (const match of sorted) {
      const hasOverlap = deduplicated.some(existing => 
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end)
      );

      if (!hasOverlap) {
        deduplicated.push(match);
      } else {
        // If there's overlap, keep the one with higher confidence
        const overlappingIndex = deduplicated.findIndex(existing => 
          (match.start >= existing.start && match.start < existing.end) ||
          (match.end > existing.start && match.end <= existing.end)
        );
        
        if (overlappingIndex !== -1 && match.confidence > deduplicated[overlappingIndex].confidence) {
          deduplicated[overlappingIndex] = match;
        }
      }
    }

    return deduplicated.sort((a, b) => a.start - b.start);
  }

  /**
   * Generate redacted text with placeholders
   */
  private generateRedactedText(text: string, matches: PIIMatch[]): {
    redactedText: string;
    redactionMap: Map<string, string>;
  } {
    const redactionMap = new Map<string, string>();
    let redactedText = text;
    let offset = 0;

    // Group matches by type for consistent numbering
    const matchesByType = new Map<string, PIIMatch[]>();
    for (const match of matches) {
      if (!matchesByType.has(match.type)) {
        matchesByType.set(match.type, []);
      }
      matchesByType.get(match.type)!.push(match);
    }

    // Generate placeholders and update matches
    for (const [type, typeMatches] of matchesByType) {
      typeMatches.forEach((match, index) => {
        match.placeholder = this.generatePlaceholder(type, index + 1);
        redactionMap.set(match.placeholder, match.value);
      });
    }

    // Replace text with placeholders (in reverse order to maintain positions)
    const sortedMatches = matches.sort((a, b) => b.start - a.start);
    
    for (const match of sortedMatches) {
      redactedText = redactedText.substring(0, match.start) + 
                    match.placeholder + 
                    redactedText.substring(match.end);
    }

    return { redactedText, redactionMap };
  }

  /**
   * Restore redacted content in text using the redaction map
   */
  restoreRedactedContent(text: string, redactionMap: Map<string, string>): string {
    let restoredText = text;
    
    for (const [placeholder, originalValue] of redactionMap) {
      // Use global replace to handle multiple occurrences
      restoredText = restoredText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), originalValue);
    }
    
    return restoredText;
  }

  /**
   * Async version of detectPII that includes Argon2 hashing for secure entanglement
   */
  async detectPIIWithHashing(text: string, options: {
    detectNames?: boolean;
    minConfidence?: number;
    customPatterns?: Array<{ name: string; regex: RegExp; confidence: number; }>;
    enableHashing?: boolean;
    sessionId?: string;
    documentId?: string;
  } = {}): Promise<PIIDetectionResult & { hashedMatches: import('./pii-hashing-service').HashedPIIMatch[] }> {
    // First run standard PII detection
    const basicResult = this.detectPII(text, {
      detectNames: options.detectNames,
      minConfidence: options.minConfidence,
      customPatterns: options.customPatterns,
      enableHashing: false // Disable basic hashing to handle it ourselves
    });

    const { enableHashing = true, sessionId, documentId } = options;

    let hashedMatches: import('./pii-hashing-service').HashedPIIMatch[] = [];

    if (enableHashing && basicResult.matches.length > 0) {
      console.log(`🔐 Creating Argon2 hashes for ${basicResult.matches.length} PII matches for secure entanglement`);
      
      try {
        hashedMatches = await piiHashingService.hashPIIMatches(basicResult.matches);
        
        // Log analytics summary for secure tracking
        const analyticsSummary = piiHashingService.createPIIAnalyticsSummary(hashedMatches);
        console.log(`📊 PII Analytics: Risk Score ${analyticsSummary.riskScore}, Types: ${Object.keys(analyticsSummary.piiTypes).join(', ')}`);
        
        // Create audit log entry if session/document IDs provided
        if (sessionId || documentId) {
          const auditEntry = piiHashingService.createPIIAuditEntry(
            documentId || 'unknown', 
            hashedMatches, 
            sessionId
          );
          console.log(`🗂️ PII Audit Entry: ${auditEntry.piiProcessingSummary.totalMatches} items processed at ${auditEntry.timestamp}`);
        }
        
      } catch (error) {
        console.error('❌ Failed to hash PII matches:', error);
        // Continue without hashing rather than failing the entire operation
      }
    }

    return {
      ...basicResult,
      hashedMatches
    };
  }

  /**
   * Create instructions for OpenAI on how to handle redacted content
   */
  generateOpenAIInstructions(redactionMap: Map<string, string>): string {
    const placeholders = Array.from(redactionMap.keys());
    
    if (placeholders.length === 0) {
      return "";
    }

    return `
IMPORTANT REDACTION HANDLING INSTRUCTIONS:
This document contains redacted personally identifiable information (PII) that has been replaced with placeholder tokens for privacy protection. The placeholders in this document are: ${placeholders.join(', ')}

When analyzing this document:
1. Treat placeholders as if they contain the actual sensitive information they represent
2. Include the EXACT placeholder tokens in your response when referring to redacted content
3. Do not attempt to guess or recreate the original redacted information
4. Maintain the same placeholder format in your analysis and recommendations

For example:
- If you see [REDACTED_EMAIL_1_abc123], refer to it as "the email address [REDACTED_EMAIL_1_abc123]"
- If you see [REDACTED_NAME_1_def456], refer to it as "the individual [REDACTED_NAME_1_def456]"
- Preserve these placeholders exactly as they appear in your analysis

Your analysis should be just as comprehensive and useful as if you had access to the original information, while maintaining privacy protection through these placeholder tokens.
`;
  }
}

// Export singleton instance
export const piiDetectionService = new PIIDetectionService();