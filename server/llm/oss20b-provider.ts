import type { DocumentAnalysis } from "@shared/schema";
import type { LLMProvider, LLMAnalysisOptions } from "./provider";
import { securityLogger } from "../security-logger";
import { hasAdvocacyAccess, isFeatureEnabled } from "../feature-flags";
import { z } from "zod";
import type { CircuitBreaker } from "../circuit-breaker";
import { CircuitBreakerFactory, CircuitState } from "../circuit-breaker";

// Zod schema for runtime validation of DocumentAnalysis response
const DocumentAdvocacySchema = z.object({
  negotiationStrategies: z.array(z.string()).optional(),
  counterOffers: z.array(z.string()).optional(),
  fairnessReminders: z.array(z.string()).optional(),
  leverageOpportunities: z.array(z.string()).optional()
}).optional();

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
  })),
  userAdvocacy: DocumentAdvocacySchema
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

interface OpenAIStyleChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenAIStyleResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<OpenAIStyleChoice>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OllamaChatMessage {
  role: string;
  content: string;
}

interface OllamaChatResponse {
  model: string;
  created_at?: string;
  message?: OllamaChatMessage;
  messages?: OllamaChatMessage[];
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  id?: string;
}

type RawOSS20BResponse =
  | { kind: 'openai'; data: OpenAIStyleResponse }
  | { kind: 'ollama'; data: OllamaChatResponse };

interface NormalizedLLMResponse {
  model: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  finishReason?: string;
  id?: string;
  origin: 'openai-compatible' | 'ollama';
  raw: unknown;
}

interface RequestTarget {
  kind: 'openai' | 'ollama';
  path: string;
}

class EndpointUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EndpointUnavailableError';
  }
}

export class LocalOss20BProvider implements LLMProvider {
  public readonly name = "LocalOSS20B";
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeout: number = 15000; // 15 second request timeout keeps UI responsive
  private readonly maxRetries: number = 1; // Fail fast and fall back to OpenAI if needed
  private readonly requestTargets: RequestTarget[] = [
    { kind: 'openai', path: '/v1/chat/completions' },
    { kind: 'ollama', path: '/api/chat' }
  ];
  private readonly ollamaCircuitBreaker: CircuitBreaker;

  constructor() {
    // Default to the local Ollama-compatible endpoint. Allow overrides for advanced setups.
    this.baseUrl = process.env.LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434";
    // Force the OSS20B-compatible model naming so downstream logging is consistent.
    this.defaultModel = process.env.LOCAL_LLM_MODEL || "gpt-oss:20b";
    this.ollamaCircuitBreaker = CircuitBreakerFactory.createApiCircuitBreaker("LocalOllamaLLM");
    console.log(`🔧 LocalOSS20BProvider configured with baseUrl: ${this.baseUrl}, model: ${this.defaultModel}`);
  }

  async analyzeDocument(
    content: string, 
    title: string, 
    options: LLMAnalysisOptions = {}
  ): Promise<DocumentAnalysis> {
    const {
      model, // Ignore the incoming model name
      temperature = 0.3,
      maxTokens = 4000,
      ip,
      userAgent,
      sessionId,
      userId,
      subscriptionTierId,
      includeAdvocacy
    } = options;

    // Always use the local model name, regardless of what OpenAI model name was passed
    const localModel = this.defaultModel;
    const tierId = subscriptionTierId || 'free';
    const allowAdvocacy = isFeatureEnabled('advocacy') && hasAdvocacyAccess(tierId);
    const requestedAdvocacy = includeAdvocacy !== undefined ? includeAdvocacy : true;
    const shouldIncludeAdvocacy = allowAdvocacy && requestedAdvocacy;

    try {
      // Log usage for audit purposes
      if (ip && userAgent && sessionId) {
        securityLogger.logLLMUsage(ip, userAgent, sessionId, title, "OSS20B");
      }

      // Log request metadata only (no sensitive content)
      console.log(`🤖 Sending to Local OSS20B (${localModel}):`);
      console.log(`   - Document: "${title}"`);
      console.log(`   - Content length: ${content.length} characters`);
      console.log(`   - Base URL: ${this.baseUrl}`);
      if (model && model !== localModel) {
        console.log(`   - Original model requested: ${model} (using ${localModel} instead)`);
      }
      console.log(`   - Subscription tier: ${tierId} (advocacy ${shouldIncludeAdvocacy ? 'enabled' : 'disabled'})`);
      
      // Check if content seems to be garbled or has extraction issues
      const readableRatio = (content.match(/[a-zA-Z\s]/g) || []).length / content.length;
      console.log(`   - Readable character ratio: ${(readableRatio * 100).toFixed(1)}%`);
      
      if (readableRatio < 0.7) {
        console.log(`⚠️ WARNING: Content appears to have low readability (${(readableRatio * 100).toFixed(1)}% readable chars)`);
      }

      const responseStructureLines = [
        "\"summary\": \"A brief overall summary of the document in plain English\"",
        "\"overallRisk\": \"low|moderate|high\"",
        "\"keyFindings\": {\n    \"goodTerms\": [\"List of positive or fair terms found\"],\n    \"reviewNeeded\": [\"Terms that require attention but aren't necessarily bad\"],\n    \"redFlags\": [\"Concerning clauses or terms that pose significant risk\"]\n  }",
        "\"sections\": [\n    {\n      \"title\": \"Section name (e.g., Payment Terms, Privacy Policy, etc.)\",\n      \"riskLevel\": \"low|moderate|high\",\n      \"summary\": \"Plain English explanation of this section\",\n      \"concerns\": [\"List of specific concerns for this section if any\"]\n    }\n  ]"
      ];

      if (shouldIncludeAdvocacy) {
        responseStructureLines.push("\"userAdvocacy\": {\n    \"negotiationStrategies\": [\"Step-by-step negotiation moves that protect the user's interests\"],\n    \"counterOffers\": [\"Specific counter-proposals or edits to request for greater fairness\"],\n    \"fairnessReminders\": [\"Rights, oversight, or integrity principles the user can cite\"],\n    \"leverageOpportunities\": [\"Moments where the user can request concessions or more transparency\"]\n  }");
      }

      const responseStructure = `{
  ${responseStructureLines.join(',\n  ')}
}`;

      const focusTopics = [
        'Converting legal jargon to plain English',
        'Identifying unfair, unusual, or concerning terms',
        'Highlighting automatic renewals, data usage, and liability limitations',
        'Explaining payment terms, cancellation policies, and user rights',
        'Noting jurisdiction limitations or binding arbitration clauses'
      ];

      if (shouldIncludeAdvocacy) {
        focusTopics.push('Equipping the user with negotiation strategies, counteroffers, and fairness advocacy they can confidently raise');
      }

      const focusGuidance = focusTopics.map(topic => `- ${topic}`).join('\n');

      const prompt = `You are a legal document analysis expert. Analyze the following legal document and provide a comprehensive analysis in JSON format.

Document Title: ${title}
Document Content: ${content}

Please analyze this document and provide a JSON response with the following structure:
${responseStructure}

Focus on:
${focusGuidance}

Provide practical, actionable insights that help everyday users understand what they're agreeing to.${shouldIncludeAdvocacy ? ' When offering advocacy guidance, champion the user\'s fairness, integrity, and leverage with respectful, concrete recommendations.' : ''} IMPORTANT: Respond only with valid JSON, no additional text or formatting.`;

      const requestPayload: OSS20BRequest = {
        model: localModel,
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

      if (this.ollamaCircuitBreaker.getState() === CircuitState.OPEN) {
        console.warn("⚠️ Local Ollama circuit breaker is OPEN – skipping direct request");
      }

      const response = await this.ollamaCircuitBreaker.execute(() =>
        this.makeRequestWithRetry(requestPayload)
      );

      // Development-only: Log response structure (no content)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📥 RESPONSE STRUCTURE FROM OSS20B:`);
        const safeResponse = {
          origin: response.origin,
          id: response.id,
          model: response.model,
          usage: response.usage,
          finish_reason: response.finishReason
        };
        console.log(JSON.stringify(safeResponse, null, 2));
      }

      // Debug the response
      console.log(`🤖 OSS20B Response received:`);
      console.log(`   - Model used: ${response.model}`);
      if (response.usage?.total_tokens !== undefined) {
        console.log(`   - Tokens used: ${response.usage.total_tokens} (input: ${response.usage.prompt_tokens}, output: ${response.usage.completion_tokens})`);
      } else {
        console.log(`   - Tokens used: unavailable (provider did not return usage metrics)`);
      }
      console.log(`   - Response length: ${response.content.length} characters`);

      const analysisText = response.content;
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
      
      const analysis = validationResult.data as DocumentAnalysis;
      const normalizedAnalysis: DocumentAnalysis = {
        ...analysis,
        userAdvocacy: shouldIncludeAdvocacy
          ? this.normalizeUserAdvocacy(analysis.userAdvocacy)
          : undefined
      };

      // Debug the parsed analysis
      console.log(`📊 Analysis Results:`);
      console.log(`   - Overall Risk: ${normalizedAnalysis.overallRisk}`);
      console.log(`   - Summary length: ${normalizedAnalysis.summary?.length || 0} chars`);
      console.log(`   - Key findings: ${normalizedAnalysis.keyFindings ? Object.keys(normalizedAnalysis.keyFindings).length : 0} categories`);
      console.log(`   - Sections analyzed: ${normalizedAnalysis.sections?.length || 0}`);
      if (shouldIncludeAdvocacy) {
        const advocacy = normalizedAnalysis.userAdvocacy;
        console.log(`   - Advocacy guidance: ${advocacy ? (advocacy.negotiationStrategies.length + advocacy.counterOffers.length + advocacy.fairnessReminders.length + advocacy.leverageOpportunities.length) : 0} items`);
      }
      // Remove summary preview to avoid logging sensitive content

      // Response structure is now validated by Zod schema above

      // Track usage if userId is provided
      if (userId && response.usage?.total_tokens) {
        const { subscriptionService } = await import("../subscription-service");
        await subscriptionService.trackUsage(
          userId,
          response.usage.total_tokens,
          localModel
        );
      }

      console.log(`✅ Document analysis completed successfully with OSS20B`);
      return normalizedAnalysis;
    } catch (error) {
      console.error("Error analyzing document with OSS20B:", error);

      // Attempt to fall back to the hosted OpenAI provider when available so the
      // request completes quickly instead of leaving the UI spinning.
      if (this.shouldAttemptFallback()) {
        try {
          const fallbackAnalysis = await this.fallbackToOpenAI(content, title, {
            ...options,
            includeAdvocacy: shouldIncludeAdvocacy,
            subscriptionTierId: tierId
          });
          if (fallbackAnalysis) {
            return fallbackAnalysis;
          }
        } catch (fallbackError) {
          console.error("❌ Fallback to OpenAI provider failed:", fallbackError);
          const combinedMessage = `${this.formatErrorMessage(error)} | Fallback error: ${this.formatErrorMessage(fallbackError)}`;
          throw new Error(`Document analysis failed after OSS20B error. ${combinedMessage}`);
        }
      }

      throw new Error(`Document analysis failed: ${this.formatErrorMessage(error)}`);
    }
  }

  private normalizeUserAdvocacy(advocacy?: DocumentAnalysis['userAdvocacy']): DocumentAnalysis['userAdvocacy'] {
    return {
      negotiationStrategies: advocacy?.negotiationStrategies?.filter(Boolean) ?? [],
      counterOffers: advocacy?.counterOffers?.filter(Boolean) ?? [],
      fairnessReminders: advocacy?.fairnessReminders?.filter(Boolean) ?? [],
      leverageOpportunities: advocacy?.leverageOpportunities?.filter(Boolean) ?? []
    };
  }

  private async makeRequestWithRetry(payload: OSS20BRequest): Promise<NormalizedLLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      for (const target of this.requestTargets) {
        try {
          console.log(`🔄 Attempt ${attempt}/${this.maxRetries} to call OSS20B via ${target.path}...`);
          const rawResponse = await this.sendRequest(payload, target);
          const normalized = this.normalizeResponse(rawResponse);
          console.log(`✅ OSS20B request successful on attempt ${attempt} using ${target.kind} endpoint`);
          return normalized;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          lastError = err;

          if (error instanceof EndpointUnavailableError) {
            console.warn(`⚠️ Endpoint ${target.path} unavailable (${err.message}), trying next option...`);
            continue;
          }

          console.warn(`❌ Attempt ${attempt}/${this.maxRetries} via ${target.path} failed:`, err.message);
        }
      }

      if (attempt < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`OSS20B request failed after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  private async sendRequest(payload: OSS20BRequest, target: RequestTarget): Promise<RawOSS20BResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const requestBody = target.kind === 'openai'
        ? payload
        : this.prepareOllamaPayload(payload);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (target.kind === 'openai') {
        headers['Authorization'] = 'Bearer dummy-token';
        headers['ngrok-skip-browser-warning'] = 'true';
      } else {
        headers['Accept'] = 'application/json';
      }

      const response = await fetch(`${this.baseUrl}${target.path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 404 || response.status === 405) {
        throw new EndpointUnavailableError(`HTTP ${response.status}`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      return target.kind === 'openai'
        ? { kind: 'openai', data: data as OpenAIStyleResponse }
        : { kind: 'ollama', data: data as OllamaChatResponse };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof EndpointUnavailableError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request to ${target.path} timed out after ${this.timeout}ms`);
      }

      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private prepareOllamaPayload(payload: OSS20BRequest): Record<string, unknown> {
    const options: Record<string, number> = {};

    if (typeof payload.temperature === 'number') {
      options.temperature = payload.temperature;
    }

    if (typeof payload.max_tokens === 'number') {
      options.num_predict = payload.max_tokens;
    }

    const basePayload: Record<string, unknown> = {
      model: payload.model,
      messages: payload.messages,
      stream: payload.stream ?? false
    };

    if (Object.keys(options).length > 0) {
      basePayload.options = options;
    }

    return basePayload;
  }

  private normalizeResponse(response: RawOSS20BResponse): NormalizedLLMResponse {
    if (response.kind === 'openai') {
      const choice = response.data.choices[0];
      const content = choice?.message?.content;

      if (!content) {
        throw new Error('No message content returned from OSS20B (openai-compatible response)');
      }

      return {
        model: response.data.model,
        content,
        usage: response.data.usage,
        finishReason: choice.finish_reason,
        id: response.data.id,
        origin: 'openai-compatible',
        raw: response.data
      };
    }

    const data = response.data;
    const assistantMessages = data.messages?.filter(message => message.role === 'assistant') ?? [];
    const joinedAssistantContent = assistantMessages.map(message => message.content).filter(Boolean).join('\n\n');
    const content = data.message?.content || joinedAssistantContent;

    if (!content) {
      throw new Error('No message content returned from OSS20B (ollama response)');
    }

    const promptTokens = typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : undefined;
    const completionTokens = typeof data.eval_count === 'number' ? data.eval_count : undefined;
    const totalTokens = typeof promptTokens === 'number' && typeof completionTokens === 'number'
      ? promptTokens + completionTokens
      : undefined;

    return {
      model: data.model,
      content,
      usage: totalTokens !== undefined ? {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens
      } : undefined,
      finishReason: data.done_reason,
      id: data.id || data.created_at,
      origin: 'ollama',
      raw: data
    };
  }

  private shouldAttemptFallback(): boolean {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("⚠️ OpenAI API key not configured – skipping fallback");
      return false;
    }

    return true;
  }

  private async fallbackToOpenAI(
    content: string,
    title: string,
    options: LLMAnalysisOptions
  ): Promise<DocumentAnalysis> {
    console.log("🔁 Falling back to OpenAI provider for analysis");

    const { OpenAIProvider } = await import("./openai-provider");
    const provider = new OpenAIProvider();

    // Ensure the OpenAI provider receives a reasonable default model if none
    // was requested (local deployments often pass oss-specific identifiers).
    const sanitizedOptions: LLMAnalysisOptions = {
      ...options,
      model: options.model && !options.model.startsWith("gpt-oss")
        ? options.model
        : "gpt-4o-mini",
    };

    const analysis = await provider.analyzeDocument(content, title, sanitizedOptions);
    console.log("✅ Fallback to OpenAI provider succeeded");
    return analysis;
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "Unknown error";
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
    
    // Fix common JSON issues from local models
    try {
      // First, try to parse as-is
      JSON.parse(text);
      return text;
    } catch (error) {
      console.log('🔧 JSON cleanup: Original parsing failed, attempting fixes...');
      
      // Fix trailing commas in arrays and objects
      let fixed = text
        .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas before } or ]
        .replace(/([^,\s])\s*\n\s*([}\]])/g, '$1$2')  // Remove newlines before closing brackets
        .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
        .replace(/,\s*]/g, ']');  // Remove trailing commas in arrays
      
      // Fix missing commas between array elements (common issue)
      fixed = fixed.replace(/"\s*\n\s*"/g, '", "');
      
      // Fix missing commas between object properties
      fixed = fixed.replace(/"\s*\n\s*"/g, '", "');
      
      // Try to fix incomplete JSON by finding the last complete object/array
      if (!fixed.endsWith('}') && !fixed.endsWith(']')) {
        // Find the last complete closing brace or bracket
        let lastBrace = fixed.lastIndexOf('}');
        let lastBracket = fixed.lastIndexOf(']');
        let cutPoint = Math.max(lastBrace, lastBracket);
        
        if (cutPoint > 0) {
          fixed = fixed.substring(0, cutPoint + 1);
          console.log('🔧 JSON cleanup: Truncated incomplete JSON');
        }
      }
      
      try {
        JSON.parse(fixed);
        console.log('✅ JSON cleanup: Successfully fixed JSON formatting');
        return fixed;
      } catch (secondError) {
        console.warn('⚠️ JSON cleanup: Could not auto-fix JSON, returning original');
        return text;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    if (this.ollamaCircuitBreaker.getState() === CircuitState.OPEN) {
      console.warn("⚠️ OSS20B circuit breaker is OPEN – reporting service as unavailable");
      return false;
    }

    try {
      console.log(`🔍 Checking OSS20B availability at ${this.baseUrl}...`);

      const probePayload: OSS20BRequest = {
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0.1,
        max_tokens: 1,
        stream: false
      };

      for (const target of this.requestTargets) {
        try {
          await this.sendRequest(probePayload, target);
          console.log(`✅ OSS20B provider is available via ${target.path}`);
          return true;
        } catch (error) {
          if (error instanceof EndpointUnavailableError) {
            continue;
          }

          const message = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️ Availability check via ${target.path} failed: ${message}`);
        }
      }

      console.warn("⚠️ OSS20B provider endpoints appear unavailable");
      return false;
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