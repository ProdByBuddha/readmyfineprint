import type { DocumentAnalysis } from "@shared/schema";

export interface LLMAnalysisOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
  subscriptionTierId?: string;
  includeAdvocacy?: boolean;
}

export interface LLMProvider {
  name: string;
  
  /**
   * Analyze a document and return a structured analysis
   * @param content The document content to analyze
   * @param title The document title
   * @param options Analysis options including model, temperature, etc.
   * @returns Promise resolving to DocumentAnalysis
   */
  analyzeDocument(
    content: string, 
    title: string, 
    options: LLMAnalysisOptions
  ): Promise<DocumentAnalysis>;
  
  /**
   * Check if the provider is available/healthy
   * @returns Promise resolving to boolean indicating availability
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get provider information
   * @returns Provider metadata
   */
  getInfo(): {
    name: string;
    version?: string;
    models?: string[];
    maxTokens?: number;
  };
}