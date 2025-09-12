import type { DocumentAnalysis } from "@shared/schema";
import type { LLMProvider, LLMAnalysisOptions } from "./provider";
import { securityLogger } from "../security-logger";
import { z } from "zod";

// Zod schema for runtime validation of DocumentAnalysis response
const DocumentAnalysisSchema = z.object({
  summary: z.string(),
  overallRisk: z.enum(['low', 'moderate', 'high']),
  keyFindings: z.object({
    goodTerms: z.array(z.string()),
    reviewNeeded: z.array(z.string()),
    redFlags: z.array(z.string())
  }),
  sections: z.array(z.object({
    title: z.string(),
    riskLevel: z.enum(['low', 'moderate', 'high']),
    summary: z.string(),
    concerns: z.array(z.string()).optional()
  }))
});

interface OSS20BRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OSS20BResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LocalOss20BProvider implements LLMProvider {
  public readonly name = "LocalOSS20B";
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeout: number = 60000; // 60 seconds
  private readonly maxRetries: number = 3;

  constructor() {
    // Use the ngrok URL as the base URL for the local OSS20B model
    this.baseUrl = "https://genuine-shepherd-decent.ngrok-free.app";
    // Use the model name from LOCAL_LLM_MODEL or default to gpt-oss20b
    this.defaultModel = process.env.LOCAL_LLM_MODEL || "gpt-oss20b";
    console.log(`🔧 LocalOSS20BProvider configured with baseUrl: ${this.baseUrl}, model: ${this.defaultModel}`);
  }

  async analyzeDocument(
    content: string, 
    title: string, 
    options: LLMAnalysisOptions = {}
  ): Promise<DocumentAnalysis> {
    const {
      model = this.defaultModel,
      temperature = 0.3,
      maxTokens = 4000,
      ip,
      userAgent,
      sessionId,
      userId
    } = options;

    try {
      // Log usage for audit purposes
      if (ip && userAgent && sessionId) {
        securityLogger.logLLMUsage(ip, userAgent, sessionId, title, "OSS20B");
      }

      // Log request metadata only (no sensitive content)
      console.log(`🤖 Sending to Local OSS20B (${model}):`);
      console.log(`   - Document: "${title}"`);
      console.log(`   - Content length: ${content.length} characters`);
      console.log(`   - Base URL: ${this.baseUrl}`);
      
      // Check if content seems to be garbled or has extraction issues
      const readableRatio = (content.match(/[a-zA-Z\s]/g) || []).length / content.length;
      console.log(`   - Readable character ratio: ${(readableRatio * 100).toFixed(1)}%`);
      
      if (readableRatio < 0.7) {
        console.log(`⚠️ WARNING: Content appears to have low readability (${(readableRatio * 100).toFixed(1)}% readable chars)`);
      }

      const prompt = `You are a legal document analysis expert. Analyze the following legal document and provide a comprehensive analysis in JSON format.

Document Title: ${title}
Document Content: ${content}

Please analyze this document and provide a JSON response with the following structure:
{
  "summary": "A brief overall summary of the document in plain English",
  "overallRisk": "low|moderate|high",
  "keyFindings": {
    "goodTerms": ["List of positive or fair terms found"],
    "reviewNeeded": ["Terms that require attention but aren't necessarily bad"],
    "redFlags": ["Concerning clauses or terms that pose significant risk"]
  },
  "sections": [
    {
      "title": "Section name (e.g., Payment Terms, Privacy Policy, etc.)",
      "riskLevel": "low|moderate|high",
      "summary": "Plain English explanation of this section",
      "concerns": ["List of specific concerns for this section if any"]
    }
  ]
}

Focus on:
- Converting legal jargon to plain English
- Identifying unfair, unusual, or concerning terms
- Highlighting automatic renewals, data usage, liability limitations
- Explaining payment terms, cancellation policies, and user rights
- Noting jurisdiction limitations or binding arbitration clauses

Provide practical, actionable insights that help everyday users understand what they're agreeing to. IMPORTANT: Respond only with valid JSON, no additional text or formatting.`;

      const requestPayload: OSS20BRequest = {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a legal document analysis expert who specializes in making complex legal language understandable to everyday users. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false
      };

      // Development-only: Log request structure (no content)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📤 REQUEST STRUCTURE TO OSS20B:`);
        const safePayload = {
          model: requestPayload.model,
          messageCount: requestPayload.messages.length,
          temperature: requestPayload.temperature,
          max_tokens: requestPayload.max_tokens,
          stream: requestPayload.stream
        };
        console.log(JSON.stringify(safePayload, null, 2));
      }

      const response = await this.makeRequestWithRetry(requestPayload);

      // Development-only: Log response structure (no content)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📥 RESPONSE STRUCTURE FROM OSS20B:`);
        const safeResponse = {
          id: response.id,
          model: response.model,
          choiceCount: response.choices.length,
          usage: response.usage,
          finish_reason: response.choices[0]?.finish_reason
        };
        console.log(JSON.stringify(safeResponse, null, 2));
      }

      // Debug the response
      console.log(`🤖 OSS20B Response received:`);
      console.log(`   - Model used: ${response.model}`);
      console.log(`   - Tokens used: ${response.usage?.total_tokens} (input: ${response.usage?.prompt_tokens}, output: ${response.usage?.completion_tokens})`);
      console.log(`   - Response length: ${response.choices[0].message.content?.length || 0} characters`);

      const analysisText = response.choices[0].message.content;
      if (!analysisText) {
        throw new Error("No analysis content received from OSS20B");
      }

      // Clean and parse the response
      const cleanedText = this.cleanJsonResponse(analysisText);
      
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(cleanedText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response from OSS20B: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }
      
      // Validate the response structure with Zod
      const validationResult = DocumentAnalysisSchema.safeParse(parsedResponse);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid DocumentAnalysis structure from OSS20B: ${errors}`);
      }
      
      const analysis: DocumentAnalysis = validationResult.data;

      // Debug the parsed analysis
      console.log(`📊 Analysis Results:`);
      console.log(`   - Overall Risk: ${analysis.overallRisk}`);
      console.log(`   - Summary length: ${analysis.summary?.length || 0} chars`);
      console.log(`   - Key findings: ${analysis.keyFindings ? Object.keys(analysis.keyFindings).length : 0} categories`);
      console.log(`   - Sections analyzed: ${analysis.sections?.length || 0}`);
      // Remove summary preview to avoid logging sensitive content

      // Response structure is now validated by Zod schema above

      // Track usage if userId is provided
      if (userId && response.usage) {
        const { subscriptionService } = await import("../subscription-service");
        await subscriptionService.trackUsage(
          userId,
          response.usage.total_tokens,
          model
        );
      }

      console.log(`✅ Document analysis completed successfully with OSS20B`);
      return analysis;
    } catch (error) {
      console.error("Error analyzing document with OSS20B:", error);
      throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async makeRequestWithRetry(payload: OSS20BRequest): Promise<OSS20BResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.maxRetries} to call OSS20B...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer dummy-token', // Some endpoints require this
            'ngrok-skip-browser-warning': 'true' // Skip ngrok browser warning
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json() as OSS20BResponse;
        console.log(`✅ OSS20B request successful on attempt ${attempt}`);
        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`❌ Attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);
        
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`OSS20B request failed after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  private cleanJsonResponse(text: string): string {
    // Remove any markdown code blocks
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Remove any leading/trailing whitespace
    text = text.trim();
    
    // Try to find JSON content if there's extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    
    return text;
  }

  async isAvailable(): Promise<boolean> {
    try {
      console.log(`🔍 Checking OSS20B availability at ${this.baseUrl}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for health check

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        },
        signal: controller.signal
      }).catch(async () => {
        // If /health doesn't exist, try a simple chat completion
        return await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer dummy-token',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            model: this.defaultModel,
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1
          }),
          signal: controller.signal
        });
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log("✅ OSS20B provider is available");
        return true;
      } else {
        console.warn(`⚠️ OSS20B provider returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error("❌ OSS20B provider availability check failed:", error);
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
      name: "Local OSS 20B",
      version: "1.0.0",
      models: [this.defaultModel],
      maxTokens: 4096
    };
  }
}