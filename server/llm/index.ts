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

    // Check LOCAL_LLM_MODEL for gpt-oss:20b to use local OSS20B provider
    const localModel = process.env.LOCAL_LLM_MODEL;
    const useLocalOss20b = localModel === "gpt-oss:20b";
    
    console.log(`🤖 Initializing LLM provider: ${useLocalOss20b ? 'LocalOSS20B' : 'OpenAI'}`);
    console.log(`   - LOCAL_LLM_MODEL: ${localModel || 'not set'}`);

    if (useLocalOss20b) {
      this.instance = new LocalOss20BProvider();
    } else {
      this.instance = new OpenAIProvider();
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