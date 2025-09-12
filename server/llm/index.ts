import type { LLMProvider } from "./provider";
import { OpenAIProvider } from "./openai-provider";
import { LocalOss20BProvider } from "./oss20b-provider";

export class LLMFactory {
  private static instance: LLMProvider | null = null;

  /**
   * Get the configured LLM provider based on environment variables
   */
  public static getProvider(): LLMProvider {
    if (this.instance) {
      return this.instance;
    }

    const providerType = process.env.LLM_PROVIDER || "openai";
    
    console.log(`🤖 Initializing LLM provider: ${providerType}`);

    switch (providerType.toLowerCase()) {
      case "openai":
        this.instance = new OpenAIProvider();
        break;
      case "oss20b":
        this.instance = new LocalOss20BProvider();
        break;
      default:
        console.warn(`⚠️ Unknown LLM provider: ${providerType}, falling back to OpenAI`);
        this.instance = new OpenAIProvider();
        break;
    }

    console.log(`✅ LLM provider initialized: ${this.instance.name}`);
    return this.instance;
  }

  /**
   * Reset the provider instance (useful for testing)
   */
  public static reset(): void {
    this.instance = null;
  }

  /**
   * Check if the current provider is available
   */
  public static async isProviderAvailable(): Promise<boolean> {
    try {
      const provider = this.getProvider();
      return await provider.isAvailable();
    } catch (error) {
      console.error("❌ Error checking provider availability:", error);
      return false;
    }
  }
}

// Export the main function for backward compatibility
export { analyzeDocument } from "./openai-provider";

// Re-export types
export type { LLMProvider, LLMAnalysisOptions } from "./provider";