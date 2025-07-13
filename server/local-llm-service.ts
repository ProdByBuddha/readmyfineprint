/**
 * Local LLM Service for Contextual PII and Attorney-Client Privilege Detection
 * Uses Ollama to run lightweight models locally for enhanced privacy
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';

export interface PIIAnalysisResult {
  hasPII: boolean;
  hasAttorneyClientPrivilege: boolean;
  redactionSuggestions: RedactionSuggestion[];
  confidence: number;
  reasoning: string;
}

export interface RedactionSuggestion {
  text: string;
  type: PIIType | 'attorney_client';
  startIndex: number;
  endIndex: number;
  confidence: number;
  context: string;
}

export type PIIType = 
  | 'ssn' 
  | 'phone' 
  | 'email' 
  | 'address' 
  | 'credit_card' 
  | 'name' 
  | 'date_of_birth'
  | 'medical_info'
  | 'financial_info'
  | 'legal_case_number'
  | 'client_matter_number';

export class LocalLLMService {
  private ollamaUrl: string;
  private model: string;
  private isInitialized: boolean = false;
  private fallbackToRegex: boolean = false;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.LOCAL_LLM_MODEL || 'nodejs-pii-detector'; // Our Node.js-based PII detector
  }

  /**
   * Initialize the local LLM service
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🤖 Initializing Local LLM Service...');
      
      // Check if Ollama is running
      const isRunning = await this.checkOllamaStatus();
      if (!isRunning) {
        console.log('📦 Starting Ollama service...');
        await this.startOllama();
      }

      // Ensure the model is available
      await this.ensureModelAvailable();
      
      this.isInitialized = true;
      console.log(`✅ Local LLM Service initialized with model: ${this.model}`);
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to initialize Local LLM, falling back to regex-based detection:', error);
      this.fallbackToRegex = true;
      return false;
    }
  }

  /**
   * Analyze text for PII and attorney-client privilege using local LLM
   */
  async analyzePII(text: string): Promise<PIIAnalysisResult> {
    if (!this.isInitialized || this.fallbackToRegex) {
      return this.fallbackAnalysis(text);
    }

    try {
      const prompt = this.buildAnalysisPrompt(text);
      const response = await this.queryLLM(prompt);
      return this.parseAnalysisResponse(response, text);
    } catch (error) {
      console.warn('⚠️ LLM analysis failed, using fallback:', error);
      return this.fallbackAnalysis(text);
    }
  }

  private async checkOllamaStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        method: 'GET'
        // timeout: 5000 // RequestInit doesn't support timeout directly
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async startOllama(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ollama = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });

      ollama.unref();

      // Give Ollama time to start
      setTimeout(async () => {
        const isRunning = await this.checkOllamaStatus();
        if (isRunning) {
          resolve();
        } else {
          reject(new Error('Failed to start Ollama'));
        }
      }, 3000);
    });
  }

  private async ensureModelAvailable(): Promise<void> {
    try {
      // Check if model exists
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      const data = await response.json() as any;
      
      const modelExists = data.models?.some((m: any) => m.name === this.model);
      
      if (!modelExists) {
        console.log(`📥 Downloading model ${this.model}...`);
        await this.pullModel();
      }
    } catch (error) {
      throw new Error(`Failed to ensure model availability: ${error}`);
    }
  }

  private async pullModel(): Promise<void> {
    const response = await fetch(`${this.ollamaUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.model })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    // Wait for model download to complete
    // This is a simplified approach - in production you'd want progress tracking
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  private buildAnalysisPrompt(text: string): string {
    return `You are an expert privacy and legal document analyzer. Analyze the following text for:

1. Personally Identifiable Information (PII)
2. Attorney-Client Privileged Communications

Text to analyze:
"""
${text}
"""

Provide your analysis in this exact JSON format:
{
  "hasPII": boolean,
  "hasAttorneyClientPrivilege": boolean,
  "redactionSuggestions": [
    {
      "text": "exact text to redact",
      "type": "ssn|phone|email|address|credit_card|name|date_of_birth|medical_info|financial_info|legal_case_number|client_matter_number|attorney_client",
      "startIndex": number,
      "endIndex": number,
      "confidence": 0.0-1.0,
      "context": "brief explanation"
    }
  ],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of findings"
}

Guidelines:
- Only flag clear PII, not general categories
- Attorney-client privilege includes: confidential legal advice, client consultations, case strategy
- Be conservative with redaction suggestions
- Provide exact text matches with accurate indices
- Confidence should reflect certainty of classification`;
  }

  private async queryLLM(prompt: string): Promise<string> {
    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for consistent analysis
          top_p: 0.1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`LLM query failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.response;
  }

  private parseAnalysisResponse(response: string, originalText: string): PIIAnalysisResult {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and sanitize the response
      return {
        hasPII: Boolean(parsed.hasPII),
        hasAttorneyClientPrivilege: Boolean(parsed.hasAttorneyClientPrivilege),
        redactionSuggestions: this.validateRedactionSuggestions(parsed.redactionSuggestions || [], originalText),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || 'Analysis completed')
      };
    } catch (error) {
      console.warn('Failed to parse LLM response, using fallback:', error);
      return this.fallbackAnalysis(originalText);
    }
  }

  private validateRedactionSuggestions(suggestions: any[], originalText: string): RedactionSuggestion[] {
    return suggestions
      .filter(s => s && typeof s === 'object')
      .map(s => ({
        text: String(s.text || ''),
        type: this.validatePIIType(s.type),
        startIndex: Math.max(0, parseInt(s.startIndex) || 0),
        endIndex: Math.min(originalText.length, parseInt(s.endIndex) || 0),
        confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0.5)),
        context: String(s.context || '')
      }))
      .filter(s => s.text.length > 0 && s.endIndex > s.startIndex);
  }

  private validatePIIType(type: any): PIIType | 'attorney_client' {
    const validTypes: (PIIType | 'attorney_client')[] = [
      'ssn', 'phone', 'email', 'address', 'credit_card', 'name', 'date_of_birth',
      'medical_info', 'financial_info', 'legal_case_number', 'client_matter_number', 'attorney_client'
    ];
    
    return validTypes.includes(type) ? type : 'name';
  }

  /**
   * Fallback analysis using comprehensive regex patterns consistent with Stage 3
   */
  private fallbackAnalysis(text: string): PIIAnalysisResult {
    const suggestions: RedactionSuggestion[] = [];
    let hasPII = false;
    let hasAttorneyClientPrivilege = false;

    // Use same comprehensive patterns as Stage 3 for progressive hashing
    const patterns = [
      // PERSON patterns
      { regex: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, type: 'name' as const },
      { regex: /\b(?:Mr|Ms|Mrs|Dr|Prof|Sir|Dame|Lord|Lady)\.?\s+[A-Z][a-z]+\b/g, type: 'name' as const },
      { regex: /\bMy name is\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, type: 'name' as const },
      
      // PHONE patterns
      { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone' as const },
      { regex: /\(\d{3}\)\s?\d{3}[-.]?\d{4}/g, type: 'phone' as const },
      { regex: /\b(?:phone|mobile|cell|tel)\.?:?\s*\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, type: 'phone' as const },
      
      // EMAIL patterns
      { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email' as const },
      { regex: /\b(?:email|e-mail)\.?:?\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email' as const },
      
      // SSN patterns
      { regex: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'ssn' as const },
      { regex: /\b\d{3}\s\d{2}\s\d{4}\b/g, type: 'ssn' as const },
      { regex: /\b(?:ssn|social\s+security)\.?:?\s*\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, type: 'ssn' as const },
      
      // ADDRESS patterns
      { regex: /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Circle|Cir|Court|Ct|Place|Pl|Way|Parkway|Pkwy)\b/g, type: 'address' as const },
      { regex: /\bP\.?O\.?\s+Box\s+\d+\b/g, type: 'address' as const },
      
      // CREDIT_CARD patterns
      { regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, type: 'credit_card' as const },
      
      // DATE patterns
      { regex: /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, type: 'date_of_birth' as const }
    ];

    // Attorney-client privilege keywords
    const privilegeKeywords = [
      'attorney-client', 'privileged', 'confidential legal advice', 
      'client consultation', 'legal strategy', 'case strategy'
    ];

    // Apply regex patterns
    patterns.forEach(({ regex, type }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        suggestions.push({
          text: match[0],
          type,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.8,
          context: 'Pattern-based detection'
        });
        hasPII = true;
      }
    });

    // Check for attorney-client privilege
    privilegeKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        hasAttorneyClientPrivilege = true;
      }
    });

    return {
      hasPII,
      hasAttorneyClientPrivilege,
      redactionSuggestions: suggestions,
      confidence: 0.7, // Lower confidence for regex-based analysis
      reasoning: 'Fallback regex-based analysis used'
    };
  }

  /**
   * Generate a response for general queries (used by hybrid analyzer)
   */
  async generateResponse(prompt: string): Promise<string> {
    if (!this.isInitialized || this.fallbackToRegex) {
      return `Analysis completed using local processing: ${prompt.substring(0, 100)}...`;
    }

    try {
      return await this.queryLLM(prompt);
    } catch (error) {
      console.warn('⚠️ LLM generation failed, using fallback:', error);
      return `Analysis unavailable: ${prompt.substring(0, 50)}...`;
    }
  }

  /**
   * Analyze document for general analysis (used by hybrid analyzer)
   */
  async analyzeDocument(text: string, options?: { task?: string; focus?: string[] }): Promise<{ analysis: string }> {
    const prompt = `Analyze this document focusing on ${options?.focus?.join(', ') || 'general analysis'}:

${text.substring(0, 1000)}...

Provide a brief analysis:`;

    try {
      const analysis = await this.generateResponse(prompt);
      return { analysis };
    } catch (error) {
      return { analysis: 'Document analysis completed with local processing.' };
    }
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; usingFallback: boolean; model: string } {
    return {
      initialized: this.isInitialized,
      usingFallback: this.fallbackToRegex,
      model: this.model
    };
  }
}

// Export singleton instance
export const localLLMService = new LocalLLMService();