import type { LLMProvider } from "./provider";
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

    console.log("🤖 Initializing LLM provider: LocalOSS20B (forced)");
    console.log("   - LOCAL_LLM_MODEL: forcing gpt-oss:20b for local analysis");

    this.instance = new LocalOss20BProvider();

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