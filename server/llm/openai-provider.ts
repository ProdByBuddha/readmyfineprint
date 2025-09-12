import type { DocumentAnalysis } from "@shared/schema";
import type { LLMProvider, LLMAnalysisOptions } from "./provider";
import { analyzeDocument as openaiAnalyzeDocument } from "../openai";

export class OpenAIProvider implements LLMProvider {
  public readonly name = "OpenAI";

  async analyzeDocument(
    content: string, 
    title: string, 
    options: LLMAnalysisOptions = {}
  ): Promise<DocumentAnalysis> {
    const {
      model = "gpt-4o",
      ip,
      userAgent,
      sessionId,
      userId
    } = options;

    // Use the existing OpenAI implementation
    return await openaiAnalyzeDocument(
      content,
      title,
      ip,
      userAgent,
      sessionId,
      model,
      userId
    );
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        console.warn("⚠️ OpenAI API key not configured");
        return false;
      }
      
      console.log("✅ OpenAI provider is available");
      return true;
    } catch (error) {
      console.error("❌ OpenAI provider availability check failed:", error);
      return false;
    }
  }

  getInfo(): {
    name: string;
    version?: string;
    models?: string[];
    maxTokens?: number;
  } {
    return {
      name: "OpenAI",
      version: "1.0.0",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
      maxTokens: 128000
    };
  }
}

// For backward compatibility, export the analyze function
export async function analyzeDocument(
  content: string,
  title: string,
  ip?: string,
  userAgent?: string,
  sessionId?: string,
  model: string = "gpt-4o",
  userId?: string
): Promise<DocumentAnalysis> {
  const provider = new OpenAIProvider();
  return await provider.analyzeDocument(content, title, {
    model,
    ip,
    userAgent,
    sessionId,
    userId
  });
}