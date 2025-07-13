/**
 * Hybrid Document Analyzer
 * Uses Local LLM for PII detection + OpenAI for analysis (with zero-PII guarantee)
 */

import { zeroPIIAnalyzer, ZeroPIIResult } from './zero-pii-analyzer';
import { analyzeDocument as openaiAnalyze } from './openai';
import { LocalLLMService } from './local-llm-service';

export interface HybridAnalysisResult {
  localAnalysis: {
    piiDetection: any;
    basicAnalysis: string;
    documentType: string;
    keyTerms: string[];
  };
  openaiAnalysis?: {
    detailedAnalysis: string;
    legalRisks: string[];
    recommendations: string[];
    complexity: 'low' | 'medium' | 'high';
  };
  securitySummary: {
    piiProtected: boolean;
    hashesApplied: number;
    riskLevel: string;
    canUseOpenAI: boolean;
  };
  combinedResult: {
    analysis: string;
    risks: string[];
    recommendations: string[];
    confidence: number;
  };
}

export class HybridDocumentAnalyzer {
  private localLLM: LocalLLMService;
  
  constructor() {
    this.localLLM = new LocalLLMService();
  }

  /**
   * Analyze document with hybrid approach
   */
  async analyzeDocument(documentText: string, userId: string): Promise<HybridAnalysisResult> {
    console.log('🔬 Starting hybrid document analysis...');
    
    // Stage 1: Zero-PII Processing
    console.log('🛡️ Stage 1: Zero-PII security processing');
    const zeroPIIResult = await zeroPIIAnalyzer.processDocument(documentText);
    
    // Stage 2: Local LLM Analysis (always runs on original)
    console.log('🤖 Stage 2: Local LLM analysis');
    const localAnalysis = await this.performLocalAnalysis(documentText);
    
    // Stage 3: OpenAI Analysis (only if zero-PII certified)
    let openaiAnalysis = undefined;
    if (zeroPIIResult.canSendToOpenAI) {
      console.log('☁️ Stage 3: OpenAI analysis (PII-free content)');
      openaiAnalysis = await this.performOpenAIAnalysis(zeroPIIResult.cleanedText, userId);
    } else {
      console.log('🚫 Stage 3: Skipped OpenAI (PII detected - staying local)');
    }
    
    // Stage 4: Combine Results
    console.log('🔄 Stage 4: Combining analysis results');
    const combinedResult = this.combineAnalysisResults(localAnalysis, openaiAnalysis);
    
    return {
      localAnalysis,
      openaiAnalysis,
      securitySummary: {
        piiProtected: zeroPIIResult.isClean,
        hashesApplied: zeroPIIResult.piiRemovalSummary.stage2Hashing.hashedCount,
        riskLevel: zeroPIIResult.riskLevel,
        canUseOpenAI: zeroPIIResult.canSendToOpenAI
      },
      combinedResult
    };
  }

  /**
   * Perform analysis using local LLM
   */
  private async performLocalAnalysis(text: string) {
    try {
      // Basic document analysis
      const basicAnalysis = await this.localLLM.analyzeDocument(text, {
        task: 'document_analysis',
        focus: ['document_type', 'key_terms', 'basic_risks', 'summary']
      });

      // Document type detection
      const documentType = await this.detectDocumentType(text);
      
      // Key terms extraction
      const keyTerms = await this.extractKeyTerms(text);
      
      // PII detection (already done in zero-PII, but for completeness)
      const piiDetection = await this.localLLM.analyzePII(text);
      
      return {
        piiDetection,
        basicAnalysis: basicAnalysis.analysis || 'Local analysis completed',
        documentType,
        keyTerms
      };
    } catch (error) {
      console.error('Local LLM analysis failed:', error);
      return {
        piiDetection: { hasPII: false, redactionSuggestions: [] },
        basicAnalysis: 'Local analysis unavailable',
        documentType: 'unknown',
        keyTerms: []
      };
    }
  }

  /**
   * Perform analysis using OpenAI (PII-free content only)
   */
  private async performOpenAIAnalysis(cleanText: string, userId: string) {
    try {
      // Create a mock document object for the existing OpenAI function
      const mockDocument = {
        id: Date.now(),
        content: cleanText,
        userId,
        title: 'Hybrid Analysis Document',
        fileType: 'text/plain'
      };

      const openaiResult = await openaiAnalyze(mockDocument);
      
      return {
        detailedAnalysis: openaiResult.analysis || 'OpenAI analysis completed',
        legalRisks: openaiResult.legalRisks || [],
        recommendations: openaiResult.recommendations || [],
        complexity: this.assessComplexity(openaiResult.analysis || '')
      };
    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      return {
        detailedAnalysis: 'OpenAI analysis unavailable',
        legalRisks: [],
        recommendations: [],
        complexity: 'medium' as const
      };
    }
  }

  /**
   * Detect document type using local LLM
   */
  private async detectDocumentType(text: string): Promise<string> {
    const prompt = `Analyze this document and identify its type. Respond with only the document type:

${text.substring(0, 500)}...

Document type:`;

    try {
      const response = await this.localLLM.generateResponse(prompt);
      return response.trim().toLowerCase();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract key terms using local LLM
   */
  private async extractKeyTerms(text: string): Promise<string[]> {
    const prompt = `Extract the 5 most important legal terms from this document. Return only a comma-separated list:

${text.substring(0, 1000)}...

Key terms:`;

    try {
      const response = await this.localLLM.generateResponse(prompt);
      return response.split(',').map(term => term.trim()).filter(term => term.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Assess document complexity
   */
  private assessComplexity(analysis: string): 'low' | 'medium' | 'high' {
    const complexityIndicators = [
      'complex', 'sophisticated', 'intricate', 'detailed', 'comprehensive',
      'multi-party', 'cross-border', 'regulatory', 'compliance'
    ];
    
    const matches = complexityIndicators.filter(indicator => 
      analysis.toLowerCase().includes(indicator)
    ).length;
    
    if (matches >= 3) return 'high';
    if (matches >= 1) return 'medium';
    return 'low';
  }

  /**
   * Combine local and OpenAI analysis results
   */
  private combineAnalysisResults(localAnalysis: any, openaiAnalysis?: any) {
    const combinedAnalysis = [
      `Local Analysis: ${localAnalysis.basicAnalysis}`,
      openaiAnalysis ? `Detailed Analysis: ${openaiAnalysis.detailedAnalysis}` : 'Detailed analysis skipped for privacy protection'
    ].join('\n\n');

    const combinedRisks = [
      ...(openaiAnalysis?.legalRisks || []),
      // Add any local risks here if available
    ];

    const combinedRecommendations = [
      ...(openaiAnalysis?.recommendations || []),
      'Privacy-first analysis completed with local PII protection'
    ];

    const confidence = openaiAnalysis ? 0.9 : 0.7; // Higher confidence with OpenAI

    return {
      analysis: combinedAnalysis,
      risks: combinedRisks,
      recommendations: combinedRecommendations,
      confidence
    };
  }
}

export const hybridDocumentAnalyzer = new HybridDocumentAnalyzer();