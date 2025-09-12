/**
 * Hybrid Document Analyzer
 * Uses Local LLM for PII detection + OpenAI for analysis (with zero-PII guarantee)
 */

import { zeroPIIAnalyzer, ZeroPIIResult } from './zero-pii-analyzer';
import { LLMFactory } from './llm';
import { LocalLLMService } from './local-llm-service';
import type { DocumentAnalysis } from '@shared/schema';

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
        basicAnalysis: (basicAnalysis as any)?.analysis || 'Local analysis completed',
        documentType,
        keyTerms
      };
    } catch (error) {
      console.error('Local LLM analysis failed:', error);
      return {
        piiDetection: { hasPII: false, redactionSuggestions: [] },
        basicAnalysis: 'Local analysis unavailable',
        documentType: 'unknown',
        keyTerms: [] as string[]
      };
    }
  }

  /**
   * Perform analysis using OpenAI (PII-free content only)
   */
  private async performOpenAIAnalysis(cleanText: string, userId: string) {
    try {
      const provider = LLMFactory.getProvider();
      const openaiResult: DocumentAnalysis = await provider.analyzeDocument(cleanText, 'Hybrid Analysis Document', {
        model: 'gpt-4o',
        userId: userId
      });
      
      // Safe array handling with type assertions
      const sections = openaiResult.sections;
      let recommendations: string[] = [];
      
      if (sections && Array.isArray(sections)) {
        recommendations = sections
          .map((s: any) => s && s.summary && typeof s.summary === 'string' ? s.summary : '')
          .filter((s: string) => s.length > 0);
      }
      
      return {
        detailedAnalysis: openaiResult.summary || 'OpenAI analysis completed',
        legalRisks: (openaiResult.keyFindings?.redFlags as string[]) || [],
        recommendations,
        complexity: this.assessComplexity(openaiResult.summary || '')
      };
    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      return {
        detailedAnalysis: 'OpenAI analysis unavailable',
        legalRisks: [] as string[],
        recommendations: [] as string[],
        complexity: 'medium' as const
      };
    }
  }

  /**
   * Detect document type using local LLM
   */
  private async detectDocumentType(text: string): Promise<string> {
    if (!text || typeof text !== 'string') {
      return 'unknown';
    }
    
    const textSubstring = text.length > 500 ? text.substring(0, 500) : text;
    const prompt = `Analyze this document and identify its type. Respond with only the document type:

${textSubstring}...

Document type:`;

    try {
      const response = await this.localLLM.generateResponse(prompt);
      if (response && typeof response === 'string') {
        return response.trim().toLowerCase();
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract key terms using local LLM
   */
  private async extractKeyTerms(text: string): Promise<string[]> {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const textSubstring = text.length > 1000 ? text.substring(0, 1000) : text;
    const prompt = `Extract the 5 most important legal terms from this document. Return only a comma-separated list:

${textSubstring}...

Key terms:`;

    try {
      const response = await this.localLLM.generateResponse(prompt);
      if (response && typeof response === 'string') {
        return response.split(',')
          .map((term: string) => term.trim())
          .filter((term: string) => term.length > 0);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Assess document complexity
   */
  private assessComplexity(analysis: string): 'low' | 'medium' | 'high' {
    if (!analysis || typeof analysis !== 'string') {
      return 'medium';
    }
    
    const complexityIndicators: string[] = [
      'complex', 'sophisticated', 'intricate', 'detailed', 'comprehensive',
      'multi-party', 'cross-border', 'regulatory', 'compliance'
    ];
    
    const analysisLower = analysis.toLowerCase();
    const matches = complexityIndicators.filter((indicator: string) => 
      analysisLower.includes(indicator)
    ).length;
    
    if (matches >= 3) return 'high';
    if (matches >= 1) return 'medium';
    return 'low';
  }

  /**
   * Combine local and OpenAI analysis results
   */
  private combineAnalysisResults(localAnalysis: any, openaiAnalysis?: any) {
    const analysisLines: string[] = [
      `Local Analysis: ${localAnalysis.basicAnalysis}`,
      openaiAnalysis ? `Detailed Analysis: ${openaiAnalysis.detailedAnalysis}` : 'Detailed analysis skipped for privacy protection'
    ];
    
    const combinedAnalysis = analysisLines.join('\n\n');

    // Safe array handling
    const legalRisks = openaiAnalysis?.legalRisks && Array.isArray(openaiAnalysis.legalRisks) ? 
      openaiAnalysis.legalRisks : [];
    const recommendations = openaiAnalysis?.recommendations && Array.isArray(openaiAnalysis.recommendations) ? 
      openaiAnalysis.recommendations : [];
    
    const combinedRisks: string[] = [...legalRisks];
    const combinedRecommendations: string[] = [
      ...recommendations,
      'Privacy-first analysis completed with local PII protection'
    ];

    const confidence = openaiAnalysis ? 0.9 : 0.7;

    return {
      analysis: combinedAnalysis,
      risks: combinedRisks,
      recommendations: combinedRecommendations,
      confidence
    };
  }
}

export const hybridDocumentAnalyzer = new HybridDocumentAnalyzer();