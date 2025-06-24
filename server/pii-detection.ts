import crypto from 'crypto';

export interface PIIMatch {
  type: 'ssn' | 'email' | 'phone' | 'creditCard' | 'address' | 'name' | 'dob' | 'custom';
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
}

export class PIIDetectionService {
  
  // Regex patterns for common PII types
  private patterns = {
    ssn: {
      regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      confidence: 0.9
    },
    email: {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      confidence: 0.95
    },
    phone: {
      regex: /(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
      confidence: 0.8
    },
    creditCard: {
      regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      confidence: 0.85
    },
    // Date patterns (potential DOB)
    dob: {
      regex: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
      confidence: 0.6
    },
    // Address patterns (basic street addresses)
    address: {
      regex: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl)\b/gi,
      confidence: 0.7
    }
  };

  // Common names for detection (simplified set - in production you'd use a comprehensive name database)
  private commonNames = new Set([
    'john', 'jane', 'michael', 'sarah', 'david', 'mary', 'james', 'patricia', 'robert', 'jennifer',
    'william', 'linda', 'richard', 'elizabeth', 'joseph', 'barbara', 'thomas', 'susan', 'charles', 'jessica',
    'christopher', 'karen', 'daniel', 'nancy', 'matthew', 'lisa', 'anthony', 'betty', 'mark', 'helen',
    'donald', 'sandra', 'steven', 'donna', 'andrew', 'carol', 'joshua', 'ruth', 'kenneth', 'sharon'
  ]);

  /**
   * Generate a secure placeholder for redacted content
   */
  private generatePlaceholder(type: string, index: number): string {
    const id = crypto.randomBytes(4).toString('hex');
    return `[REDACTED_${type.toUpperCase()}_${index}_${id}]`;
  }

  /**
   * Detect potential names in text
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
        
        matches.push({
          type: 'name',
          value: word,
          start,
          end,
          confidence: 0.6,
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
  } = {}): PIIDetectionResult {
    const {
      detectNames = true,
      minConfidence = 0.6,
      customPatterns = []
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

    return {
      originalText: text,
      redactedText,
      matches: sortedMatches,
      redactionMap
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