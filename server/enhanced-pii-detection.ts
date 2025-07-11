import crypto from 'node:crypto';
import { piiHashingService } from './pii-hashing-service';
import { localLLMService } from './local-llm-service';
import { CircuitBreaker, CircuitBreakerFactory } from './circuit-breaker';

export interface EnhancedPIIMatch {
  type: 'ssn' | 'email' | 'phone' | 'creditCard' | 'address' | 'name' | 'dob' | 'custom' | 'attorney_client';
  value: string;
  start: number;
  end: number;
  confidence: number; // 0-1 score
  placeholder: string;
  detectionMethod: 'regex' | 'context' | 'fuzzy' | 'composite' | 'llm';
  validationScore: number; // Additional validation confidence
  contextClues: string[]; // What made us think this is PII
  attorneyClientPrivilege?: boolean; // LLM-detected attorney-client privilege
}

export interface EnhancedPIIDetectionResult {
  originalText: string;
  redactedText: string;
  matches: EnhancedPIIMatch[];
  redactionMap: Map<string, string>;
  hashedMatches?: import('./pii-hashing-service').HashedPIIMatch[];
  hasAttorneyClientPrivilege: boolean; // LLM-detected attorney-client privilege
  llmAnalysisUsed: boolean; // Whether LLM analysis was successfully used
  detectionMetrics: {
    totalMatches: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    lowConfidenceMatches: number;
    falsePositiveRisk: number; // 0-1 estimated risk of false positives
    coverageConfidence: number; // 0-1 confidence we caught all PII
    llmConfidence?: number; // LLM analysis confidence if used
  };
}

/**
 * Enhanced PII Detection Service with Multi-Pass Analysis
 * 
 * This service uses multiple detection strategies and confidence scoring
 * to minimize both false positives and false negatives in PII detection.
 */
export class EnhancedPIIDetectionService {
  private llmCircuitBreaker: CircuitBreaker;
  private isLLMInitialized: boolean = false;
  
  constructor() {
    this.llmCircuitBreaker = CircuitBreakerFactory.createApiCircuitBreaker('LocalLLM');
  }

  /**
   * Initialize the service including local LLM
   */
  async initialize(): Promise<void> {
    // Check if Local LLM is enabled
    const isLocalLLMEnabled = process.env.ENABLE_LOCAL_LLM === 'true';
    
    if (!isLocalLLMEnabled) {
      console.log('📊 Enhanced PII Detection initialized (regex-only mode, Local LLM disabled)');
      this.isLLMInitialized = false;
      return;
    }
    
    try {
      console.log('🤖 Initializing Enhanced PII Detection with Local LLM...');
      await localLLMService.initialize();
      this.isLLMInitialized = true;
      console.log('✅ Enhanced PII Detection with LLM initialized');
    } catch (error) {
      console.warn('⚠️ LLM initialization failed, falling back to regex-only detection:', error);
      this.isLLMInitialized = false;
    }
  }
  
  // Enhanced patterns with better validation
  private patterns = {
    ssn: {
      // Multiple SSN formats with context validation
      patterns: [
        { regex: /\b\d{3}-\d{2}-\d{4}\b/g, confidence: 0.95, description: 'Standard SSN format' },
        { regex: /\b\d{3}\s\d{2}\s\d{4}\b/g, confidence: 0.90, description: 'Space-separated SSN' },
        { regex: /\bSSN:?\s*(\d{3}[-\s]?\d{2}[-\s]?\d{4})\b/gi, confidence: 0.98, description: 'Labeled SSN' },
        { regex: /\bsocial\s+security:?\s*(\d{3}[-\s]?\d{2}[-\s]?\d{4})\b/gi, confidence: 0.97, description: 'Full social security label' }
      ],
      contextValidators: [
        { keywords: ['ssn', 'social', 'security'], boost: 0.1 },
        { keywords: ['tax', 'w2', 'w-2', 'employment'], boost: 0.05 },
        { blacklist: ['phone', 'fax', 'zip'], penalty: -0.3 }
      ]
    },
    
    email: {
      patterns: [
        { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, confidence: 0.98, description: 'Standard email format' },
        { regex: /\bemail:?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/gi, confidence: 0.99, description: 'Labeled email' }
      ],
      contextValidators: [
        { keywords: ['email', 'contact', '@'], boost: 0.05 },
        { blacklist: ['example.com', 'test.com', 'domain.com'], penalty: -0.8 }
      ]
    },
    
    phone: {
      patterns: [
        { regex: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g, confidence: 0.85, description: 'US phone format' },
        { regex: /\bphone:?\s*(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/gi, confidence: 0.95, description: 'Labeled phone' },
        { regex: /\bcall:?\s*(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/gi, confidence: 0.90, description: 'Call instruction' }
      ],
      contextValidators: [
        { keywords: ['phone', 'call', 'tel', 'contact'], boost: 0.1 },
        { blacklist: ['911', '411', '311', '211'], penalty: -0.9 }, // Emergency numbers
        { blacklist: ['1000', '2000', '3000'], penalty: -0.5 } // Round numbers likely not phones
      ]
    },
    
    creditCard: {
      patterns: [
        { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?)\b/g, confidence: 0.95, description: 'Visa card' },
        { regex: /\b(?:5[1-5][0-9]{14})\b/g, confidence: 0.95, description: 'MasterCard' },
        { regex: /\b(?:3[47][0-9]{13})\b/g, confidence: 0.95, description: 'American Express' },
        { regex: /\b(?:6(?:011|5[0-9]{2})[0-9]{12})\b/g, confidence: 0.95, description: 'Discover' }
      ],
      contextValidators: [
        { keywords: ['card', 'credit', 'payment', 'visa', 'mastercard', 'amex'], boost: 0.1 },
        { blacklist: ['account', 'id', 'serial'], penalty: -0.2 }
      ]
    },
    
    dob: {
      patterns: [
        { regex: /\b(?:0?[1-9]|1[0-2])[-\/](0?[1-9]|[12][0-9]|3[01])[-\/](19|20)\d{2}\b/g, confidence: 0.75, description: 'MM/DD/YYYY format' },
        { regex: /\b(19|20)\d{2}[-\/](0?[1-9]|1[0-2])[-\/](0?[1-9]|[12][0-9]|3[01])\b/g, confidence: 0.75, description: 'YYYY/MM/DD format' },
        { regex: /\bbirth\s*date:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/gi, confidence: 0.95, description: 'Labeled birth date' },
        { regex: /\bdob:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/gi, confidence: 0.95, description: 'DOB label' }
      ],
      contextValidators: [
        { keywords: ['birth', 'born', 'dob', 'age'], boost: 0.2 },
        { blacklist: ['contract', 'agreement', 'expire'], penalty: -0.4 }
      ]
    },
    
    address: {
      patterns: [
        // More specific address patterns to avoid time periods like "60 days"
        { regex: /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl|Way|Pkwy|Parkway|Terrace|Ter)\b/gi, confidence: 0.8, description: 'Street address' },
        { regex: /\baddress:?\s*(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl|Way|Pkwy|Parkway|Terrace|Ter))\b/gi, confidence: 0.95, description: 'Labeled address' },
        // PO Box patterns
        { regex: /\bP\.?O\.?\s*Box\s+\d+/gi, confidence: 0.9, description: 'PO Box' }
      ],
      contextValidators: [
        { keywords: ['address', 'street', 'residence', 'home', 'located', 'property'], boost: 0.1 },
        { blacklist: ['company', 'corporate', 'office', 'days', 'hours', 'minutes', 'notice', 'period', 'return', 'after', 'within'], penalty: -0.6 } // Strong penalty for time-related contexts
      ]
    }
  };

  // Common names database - expanded with more validation
  private commonNames = new Set([
    'john', 'jane', 'michael', 'sarah', 'david', 'mary', 'james', 'patricia', 'robert', 'jennifer',
    'william', 'linda', 'richard', 'elizabeth', 'joseph', 'barbara', 'thomas', 'susan', 'charles', 'jessica',
    'christopher', 'karen', 'daniel', 'nancy', 'matthew', 'lisa', 'anthony', 'betty', 'mark', 'helen',
    'donald', 'sandra', 'steven', 'donna', 'andrew', 'carol', 'joshua', 'ruth', 'kenneth', 'sharon',
    'alex', 'alexander', 'alexandra', 'jordan', 'rivera', 'bennett', 'smith', 'johnson', 'brown', 'davis',
    'miller', 'wilson', 'moore', 'taylor', 'anderson', 'thomas', 'jackson', 'white', 'harris', 'martin',
    'thompson', 'garcia', 'martinez', 'robinson', 'clark', 'rodriguez', 'lewis', 'lee', 'walker', 'hall',
    'allen', 'young', 'hernandez', 'king', 'wright', 'lopez', 'hill', 'scott', 'green', 'adams',
    'baker', 'gonzalez', 'nelson', 'carter', 'mitchell', 'perez', 'roberts', 'turner', 'phillips', 'campbell'
  ]);

  // Common false positive contexts and terms
  private falsePositiveContexts = new Set([
    'example', 'sample', 'demo', 'test', 'placeholder', 'template', 'xxx', 'redacted',
    // Legal document terms that aren't names
    'tenant', 'landlord', 'lessor', 'lessee', 'party', 'parties', 'property', 'premises',
    'agreement', 'contract', 'lease', 'rental', 'deposit', 'payment', 'monthly', 'annual',
    'start', 'end', 'date', 'term', 'period', 'notice', 'late', 'fee', 'security',
    'pet', 'rent', 'utility', 'maintenance', 'repair', 'damage', 'liability', 'insurance',
    // Days and time periods
    'days', 'day', 'week', 'month', 'year', 'hours', 'minutes', 'period', 'return',
    // Generic placeholders
    'name', 'address', 'phone', 'email', 'number', 'amount', 'total', 'balance'
  ]);

  // Legal document section headers that aren't PII
  private legalTerms = new Set([
    'tenant name', 'landlord name', 'start date', 'end date', 'monthly rent', 
    'late fee', 'security deposit', 'pet deposit', 'lease term', 'rental amount',
    'payment due', 'notice period', 'termination fee', 'early termination',
    'property address', 'mailing address', 'contact information'
  ]);

  /**
   * Multi-pass PII detection with enhanced accuracy including LLM analysis
   */
  async detectPIIEnhanced(text: string, options: {
    enableHashing?: boolean;
    sessionId?: string;
    documentId?: string;
    aggressiveMode?: boolean; // When true, bias toward over-detection
    customPatterns?: Array<{ name: string; regex: RegExp; confidence: number; }>;
    enableLLMAnalysis?: boolean; // Enable local LLM for contextual analysis
  } = {}): Promise<EnhancedPIIDetectionResult> {
    
    const { 
      enableHashing = true, 
      sessionId, 
      documentId, 
      aggressiveMode = true, // Default to aggressive for privacy protection
      customPatterns = [],
      enableLLMAnalysis = true
    } = options;

    console.log(`🔍 Enhanced multi-pass PII detection starting for document: "${documentId || 'unknown'}"`);
    console.log(`   - Mode: ${aggressiveMode ? 'Aggressive (privacy-first)' : 'Balanced'}`);
    console.log(`   - LLM Analysis: ${enableLLMAnalysis && this.isLLMInitialized ? 'Enabled' : 'Disabled'}`);

    // Pass 1: Regex-based detection with confidence scoring
    const regexMatches = this.detectWithRegexPatterns(text, aggressiveMode);
    console.log(`   - Pass 1 (Regex): Found ${regexMatches.length} potential matches`);

    // Pass 2: Context-aware validation
    const validatedMatches = this.validateWithContext(text, regexMatches);
    console.log(`   - Pass 2 (Context): Validated ${validatedMatches.length} matches`);

    // Pass 3: Fuzzy detection for missed patterns
    const fuzzyMatches = this.detectWithFuzzyMatching(text, validatedMatches);
    console.log(`   - Pass 3 (Fuzzy): Found ${fuzzyMatches.length} additional matches`);

    // Pass 4: Name detection with enhanced validation
    const nameMatches = this.detectNamesEnhanced(text, [...validatedMatches, ...fuzzyMatches]);
    console.log(`   - Pass 4 (Names): Found ${nameMatches.length} name matches`);

    // Pass 5: LLM-based contextual analysis (NEW)
    let llmMatches: EnhancedPIIMatch[] = [];
    let llmAnalysisUsed = false;
    let hasAttorneyClientPrivilege = false;
    let llmConfidence = 0;

    if (enableLLMAnalysis && this.isLLMInitialized) {
      try {
        const llmResult = await this.analyzeWithLLM(text, [...validatedMatches, ...fuzzyMatches, ...nameMatches]);
        llmMatches = llmResult.matches;
        llmAnalysisUsed = true;
        hasAttorneyClientPrivilege = llmResult.hasAttorneyClientPrivilege;
        llmConfidence = llmResult.confidence;
        console.log(`   - Pass 5 (LLM): Found ${llmMatches.length} additional matches, Attorney-Client: ${hasAttorneyClientPrivilege}`);
      } catch (error) {
        console.warn(`   - Pass 5 (LLM): Failed, continuing without LLM analysis:`, error);
      }
    }

    // Combine and deduplicate all matches
    const allMatches = [...validatedMatches, ...fuzzyMatches, ...nameMatches, ...llmMatches];
    const deduplicatedMatches = this.deduplicateEnhancedMatches(allMatches);
    console.log(`   - Final: ${deduplicatedMatches.length} unique PII matches after deduplication`);

    // Generate redacted text and placeholders
    const { redactedText, redactionMap } = this.generateRedactedText(text, deduplicatedMatches);

    // Calculate detection metrics
    const detectionMetrics = this.calculateDetectionMetrics(deduplicatedMatches, text, llmConfidence);

    // Generate hashed matches if enabled
    let hashedMatches = undefined;
    if (enableHashing && deduplicatedMatches.length > 0) {
      console.log(`🔐 Creating Argon2 hashes for ${deduplicatedMatches.length} enhanced PII matches`);
      try {
        // Convert enhanced matches to standard format for hashing
        const standardMatches = deduplicatedMatches.map(match => ({
          type: match.type,
          value: match.value,
          start: match.start,
          end: match.end,
          confidence: match.confidence,
          placeholder: match.placeholder
        }));
        
        hashedMatches = await piiHashingService.hashPIIMatches(standardMatches);
      } catch (error) {
        console.error('❌ Failed to hash enhanced PII matches:', error);
      }
    }

    console.log(`✅ Enhanced PII detection complete:`);
    console.log(`   - Detection confidence: ${(detectionMetrics.coverageConfidence * 100).toFixed(1)}%`);
    console.log(`   - False positive risk: ${(detectionMetrics.falsePositiveRisk * 100).toFixed(1)}%`);
    console.log(`   - High confidence matches: ${detectionMetrics.highConfidenceMatches}`);
    console.log(`   - Attorney-Client Privilege: ${hasAttorneyClientPrivilege}`);

    return {
      originalText: text,
      redactedText,
      matches: deduplicatedMatches,
      redactionMap,
      hashedMatches,
      hasAttorneyClientPrivilege,
      llmAnalysisUsed,
      detectionMetrics
    };
  }

  /**
   * Pass 5: LLM-based contextual analysis
   */
  private async analyzeWithLLM(text: string, existingMatches: EnhancedPIIMatch[]): Promise<{
    matches: EnhancedPIIMatch[];
    hasAttorneyClientPrivilege: boolean;
    confidence: number;
  }> {
    const result = await this.llmCircuitBreaker.execute(async () => {
      return await localLLMService.analyzePII(text);
    });

    const llmMatches: EnhancedPIIMatch[] = [];
    const existingRanges = existingMatches.map(m => ({ start: m.start, end: m.end }));

    // Convert LLM suggestions to EnhancedPIIMatch format
    for (const suggestion of result.redactionSuggestions) {
      // Skip if this overlaps with existing matches
      if (!this.overlapsExisting(suggestion.startIndex, suggestion.endIndex, existingRanges)) {
        // Map LLM types to our types
        const mappedType = this.mapLLMTypeToEnhancedType(suggestion.type);
        
        llmMatches.push({
          type: mappedType,
          value: suggestion.text,
          start: suggestion.startIndex,
          end: suggestion.endIndex,
          confidence: suggestion.confidence,
          placeholder: '',
          detectionMethod: 'llm',
          validationScore: suggestion.confidence,
          contextClues: [`LLM: ${suggestion.context}`],
          attorneyClientPrivilege: suggestion.type === 'attorney_client'
        });
      }
    }

    return {
      matches: llmMatches,
      hasAttorneyClientPrivilege: result.hasAttorneyClientPrivilege,
      confidence: result.confidence
    };
  }

  /**
   * Map LLM PII types to our enhanced types
   */
  private mapLLMTypeToEnhancedType(llmType: string): EnhancedPIIMatch['type'] {
    const typeMap: Record<string, EnhancedPIIMatch['type']> = {
      'ssn': 'ssn',
      'phone': 'phone',
      'email': 'email',
      'address': 'address',
      'credit_card': 'creditCard',
      'name': 'name',
      'date_of_birth': 'dob',
      'medical_info': 'custom',
      'financial_info': 'custom',
      'legal_case_number': 'custom',
      'client_matter_number': 'custom',
      'attorney_client': 'attorney_client'
    };

    return typeMap[llmType] || 'custom';
  }

  /**
   * Pass 1: Enhanced regex pattern detection
   */
  private detectWithRegexPatterns(text: string, aggressiveMode: boolean): EnhancedPIIMatch[] {
    const matches: EnhancedPIIMatch[] = [];
    let matchIndex = 0;

    for (const [type, typeConfig] of Object.entries(this.patterns)) {
      for (const pattern of typeConfig.patterns) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;

        while ((match = regex.exec(text)) !== null) {
          let confidence = pattern.confidence;
          
          // In aggressive mode, boost confidence to catch more potential PII
          if (aggressiveMode) {
            confidence = Math.min(1.0, confidence + 0.1);
          }

          matches.push({
            type: type as EnhancedPIIMatch['type'],
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence,
            placeholder: '', // Will be set later
            detectionMethod: 'regex',
            validationScore: pattern.confidence,
            contextClues: [pattern.description]
          });
        }
      }
    }

    return matches;
  }

  /**
   * Pass 2: Context-aware validation
   */
  private validateWithContext(text: string, matches: EnhancedPIIMatch[]): EnhancedPIIMatch[] {
    return matches.map(match => {
      const typeConfig = this.patterns[match.type as keyof typeof this.patterns];
      if (!typeConfig || !typeConfig.contextValidators) {
        return match;
      }

      // Extract context around the match (50 chars before/after)
      const contextStart = Math.max(0, match.start - 50);
      const contextEnd = Math.min(text.length, match.end + 50);
      const context = text.substring(contextStart, contextEnd).toLowerCase();

      let confidenceAdjustment = 0;
      const contextClues = [...match.contextClues];

      // Apply context validators
      for (const validator of typeConfig.contextValidators) {
        if ('keywords' in validator && validator.keywords && validator.boost !== undefined) {
          // Check for positive keywords
          for (const keyword of validator.keywords) {
            if (context.includes(keyword.toLowerCase())) {
              confidenceAdjustment += validator.boost;
              contextClues.push(`Found keyword: ${keyword}`);
            }
          }
        } else if ('blacklist' in validator) {
          // Check for negative keywords
          for (const blackword of validator.blacklist) {
            if (context.includes(blackword.toLowerCase())) {
              confidenceAdjustment += validator.penalty;
              contextClues.push(`Found blacklisted: ${blackword}`);
            }
          }
        }
      }

      // Check for false positive indicators
      const lowerValue = match.value.toLowerCase();
      for (const falsePositive of this.falsePositiveContexts) {
        if (lowerValue.includes(falsePositive) || context.includes(falsePositive)) {
          confidenceAdjustment -= 0.5;
          contextClues.push(`False positive indicator: ${falsePositive}`);
        }
      }

      // Check for legal document terms (stronger penalty for exact matches)
      for (const legalTerm of this.legalTerms) {
        if (context.includes(legalTerm)) {
          confidenceAdjustment -= 0.8; // Strong penalty for legal terms
          contextClues.push(`Legal document term: ${legalTerm}`);
        }
      }

      // Special handling for obvious non-PII patterns
      if (match.type === 'name') {
        // Check if it's part of a label or section header
        const surroundingText = text.substring(Math.max(0, match.start - 20), Math.min(text.length, match.end + 20)).toLowerCase();
        
        if (surroundingText.includes(':') || surroundingText.includes('_') || 
            /\b(name|address|phone|email|date|amount|fee|deposit|rent)\b/.test(surroundingText)) {
          confidenceAdjustment -= 0.7;
          contextClues.push('Appears to be a form label or section header');
        }
      }

      return {
        ...match,
        confidence: Math.max(0, Math.min(1, match.confidence + confidenceAdjustment)),
        validationScore: match.validationScore + confidenceAdjustment,
        contextClues,
        detectionMethod: 'context' as const
      };
    }).filter(match => match.confidence > 0.1); // Remove very low confidence matches
  }

  /**
   * Pass 3: Fuzzy matching for common PII variations
   */
  private detectWithFuzzyMatching(text: string, existingMatches: EnhancedPIIMatch[]): EnhancedPIIMatch[] {
    const fuzzyMatches: EnhancedPIIMatch[] = [];
    const existingRanges = existingMatches.map(m => ({ start: m.start, end: m.end }));

    // Fuzzy SSN detection (handles written-out numbers, etc.)
    const ssnVariations = [
      /\b(?:one|two|three|four|five|six|seven|eight|nine|zero)[-\s](?:one|two|three|four|five|six|seven|eight|nine|zero)[-\s](?:one|two|three|four|five|six|seven|eight|nine|zero)\b/gi,
      /\bsocial\s+security\s+number:?\s*([^\s]+)/gi,
      /\bssn\s*#:?\s*([^\s]+)/gi
    ];

    for (const pattern of ssnVariations) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (!this.overlapsExisting(match.index, match.index + match[0].length, existingRanges)) {
          fuzzyMatches.push({
            type: 'ssn',
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.7, // Lower confidence for fuzzy matches
            placeholder: '',
            detectionMethod: 'fuzzy',
            validationScore: 0.7,
            contextClues: ['Fuzzy SSN pattern']
          });
        }
      }
    }

    // Add more fuzzy patterns for other PII types as needed

    return fuzzyMatches;
  }

  /**
   * Pass 4: Enhanced name detection with better validation
   */
  private detectNamesEnhanced(text: string, existingMatches: EnhancedPIIMatch[]): EnhancedPIIMatch[] {
    const nameMatches: EnhancedPIIMatch[] = [];
    const existingRanges = existingMatches.map(m => ({ start: m.start, end: m.end }));
    
    // Look for name patterns with context (more specific to avoid labels)
    const namePatterns = [
      // Names with titles (high confidence)
      /\b(?:mr|mrs|ms|dr|prof)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
      // Names in action contexts (medium confidence)
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:said|wrote|stated|testified|signed|agreed|contacted)/gi,
      // Legal parties (medium confidence)
      /\b(?:plaintiff|defendant|client|witness)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
      // Signature lines (medium confidence)
      /\bsignature:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
      // Full names in quotes or parentheses (high confidence)
      /["']([A-Z][a-z]+\s+[A-Z][a-z]+)["']/gi,
      /\(([A-Z][a-z]+\s+[A-Z][a-z]+)\)/gi
    ];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const nameMatch = match[1] || match[0];
        const start = text.indexOf(nameMatch, match.index);
        const end = start + nameMatch.length;

        if (!this.overlapsExisting(start, end, existingRanges)) {
          // Validate if it contains actual names
          const words = nameMatch.split(/\s+/);
          const nameWords = words.filter(word => 
            this.commonNames.has(word.toLowerCase()) && word.length > 2
          );

          if (nameWords.length > 0) {
            const confidence = Math.min(0.9, 0.6 + (nameWords.length * 0.15));
            
            nameMatches.push({
              type: 'name',
              value: nameMatch,
              start,
              end,
              confidence,
              placeholder: '',
              detectionMethod: 'context',
              validationScore: confidence,
              contextClues: [`Contains known names: ${nameWords.join(', ')}`]
            });
          }
        }
      }
    }

    return nameMatches;
  }

  /**
   * Check if a range overlaps with existing matches
   */
  private overlapsExisting(start: number, end: number, existingRanges: { start: number; end: number }[]): boolean {
    return existingRanges.some(range => 
      (start >= range.start && start < range.end) ||
      (end > range.start && end <= range.end) ||
      (start <= range.start && end >= range.end)
    );
  }

  /**
   * Deduplicate enhanced matches, keeping highest confidence
   */
  private deduplicateEnhancedMatches(matches: EnhancedPIIMatch[]): EnhancedPIIMatch[] {
    const sorted = matches.sort((a, b) => a.start - b.start);
    const deduplicated: EnhancedPIIMatch[] = [];

    for (const match of sorted) {
      const hasOverlap = deduplicated.some(existing => 
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end)
      );

      if (!hasOverlap) {
        deduplicated.push(match);
      } else {
        // Replace if higher confidence
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
   * Generate redacted text with placeholders (reusing existing logic)
   */
  private generateRedactedText(text: string, matches: EnhancedPIIMatch[]): {
    redactedText: string;
    redactionMap: Map<string, string>;
  } {
    const redactionMap = new Map<string, string>();
    let redactedText = text;

    // Group matches by type for consistent numbering
    const matchesByType = new Map<string, EnhancedPIIMatch[]>();
    for (const match of matches) {
      if (!matchesByType.has(match.type)) {
        matchesByType.set(match.type, []);
      }
      matchesByType.get(match.type)!.push(match);
    }

    // Generate placeholders
    for (const [type, typeMatches] of matchesByType) {
      typeMatches.forEach((match, index) => {
        const id = crypto.randomBytes(4).toString('hex');
        match.placeholder = `[REDACTED_${type.toUpperCase()}_${index + 1}_${id}]`;
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
   * Calculate detection quality metrics
   */
  private calculateDetectionMetrics(matches: EnhancedPIIMatch[], text: string, llmConfidence?: number): {
    totalMatches: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    lowConfidenceMatches: number;
    falsePositiveRisk: number;
    coverageConfidence: number;
    llmConfidence?: number;
  } {
    const totalMatches = matches.length;
    const highConfidenceMatches = matches.filter(m => m.confidence >= 0.85).length;
    const mediumConfidenceMatches = matches.filter(m => m.confidence >= 0.6 && m.confidence < 0.85).length;
    const lowConfidenceMatches = matches.filter(m => m.confidence < 0.6).length;

    // Estimate false positive risk based on low confidence matches and fuzzy detection
    const fuzzyMatches = matches.filter(m => m.detectionMethod === 'fuzzy').length;
    const falsePositiveRisk = Math.min(1.0, (lowConfidenceMatches + fuzzyMatches * 0.5) / Math.max(1, totalMatches));

    // Estimate coverage confidence based on match distribution and text characteristics
    const textLength = text.length;
    const matchDensity = totalMatches / Math.max(1, textLength / 100); // matches per 100 chars
    const highConfidenceRatio = highConfidenceMatches / Math.max(1, totalMatches);
    
    // Higher confidence if we have high-confidence matches and reasonable density
    const coverageConfidence = Math.min(1.0, 
      0.7 + (highConfidenceRatio * 0.2) + Math.min(0.1, matchDensity * 0.05)
    );

    return {
      totalMatches,
      highConfidenceMatches,
      mediumConfidenceMatches,
      lowConfidenceMatches,
      falsePositiveRisk,
      coverageConfidence,
      llmConfidence
    };
  }
}

// Export singleton instance
export const enhancedPiiDetectionService = new EnhancedPIIDetectionService();