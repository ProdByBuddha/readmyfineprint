#!/usr/bin/env tsx
/**
 * Setup script for Local LLM with Ollama
 * Installs and configures Ollama for enhanced PII detection
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

class LocalLLMSetup {
  private ollamaUrl = 'http://localhost:11434';
  private recommendedModel = 'llama3.2:1b'; // Lightweight model for PII detection

  async setup() {
    console.log('🤖 Local LLM Setup for Enhanced PII Detection\n');
    
    try {
      // Step 1: Check if Ollama is installed
      await this.checkOllamaInstallation();
      
      // Step 2: Start Ollama service
      await this.startOllamaService();
      
      // Step 3: Download recommended model
      await this.downloadModel();
      
      // Step 4: Test the setup
      await this.testSetup();
      
      // Step 5: Update environment variables
      this.updateEnvironmentConfig();
      
      console.log('\n✨ Local LLM setup completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Restart your development server: npm run dev');
      console.log('2. The enhanced PII detection will now use local LLM for contextual analysis');
      console.log('3. Check logs for "🤖 Local LLM Service initialized" message');
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error);
      console.log('\n🔧 Manual installation instructions:');
      this.printManualInstructions();
      process.exit(1);
    }
  }

  private async checkOllamaInstallation(): Promise<void> {
    console.log('🔍 Checking Ollama installation...');
    
    try {
      const { stdout } = await execAsync('ollama --version');
      console.log(`✅ Ollama found: ${stdout.trim()}`);
    } catch (error) {
      console.log('⚠️ Ollama not found, installing...');
      await this.installOllama();
    }
  }

  private async installOllama(): Promise<void> {
    console.log('📦 Installing Ollama...');
    
    // Detect platform and install accordingly
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS
      try {
        await execAsync('brew install ollama');
        console.log('✅ Ollama installed via Homebrew');
      } catch (error) {
        console.log('⚠️ Homebrew not available, using curl installer...');
        await execAsync('curl -fsSL https://ollama.ai/install.sh | sh');
      }
    } else if (platform === 'linux') {
      // Linux
      await execAsync('curl -fsSL https://ollama.ai/install.sh | sh');
      console.log('✅ Ollama installed on Linux');
    } else if (platform === 'win32') {
      console.log('🪟 Windows detected - please install Ollama manually:');
      console.log('   Download from: https://ollama.ai/download/windows');
      throw new Error('Manual installation required on Windows');
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async startOllamaService(): Promise<void> {
    console.log('🚀 Starting Ollama service...');
    
    // Check if already running
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, { timeout: 2000 });
      if (response.ok) {
        console.log('✅ Ollama service already running');
        return;
      }
    } catch {
      // Service not running, start it
    }

    // Start Ollama in background
    const ollama = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    
    ollama.unref();
    
    // Wait for service to start
    console.log('⏳ Waiting for Ollama service to start...');
    
    for (let i = 0; i < 30; i++) {
      try {
        const response = await fetch(`${this.ollamaUrl}/api/tags`, { timeout: 1000 });
        if (response.ok) {
          console.log('✅ Ollama service started successfully');
          return;
        }
      } catch {
        // Still starting
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Ollama service failed to start within 30 seconds');
  }

  private async downloadModel(): Promise<void> {
    console.log(`📥 Downloading model: ${this.recommendedModel}...`);
    console.log('   This may take a few minutes depending on your internet connection.');
    
    try {
      // Check if model already exists
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      const data = await response.json() as any;
      
      const modelExists = data.models?.some((m: any) => 
        m.name === this.recommendedModel || m.name.startsWith(this.recommendedModel.split(':')[0])
      );
      
      if (modelExists) {
        console.log('✅ Model already downloaded');
        return;
      }

      // Download the model
      const pullResponse = await fetch(`${this.ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.recommendedModel })
      });

      if (!pullResponse.ok) {
        throw new Error(`Failed to download model: ${pullResponse.statusText}`);
      }

      // Monitor download progress
      let lastProgress = '';
      const reader = pullResponse.body?.getReader();
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const progress = JSON.parse(line);
              if (progress.status && progress.status !== lastProgress) {
                console.log(`   ${progress.status}`);
                lastProgress = progress.status;
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      } else {
        // Fallback: wait for completion
        await new Promise(resolve => setTimeout(resolve, 60000));
      }

      console.log(`✅ Model ${this.recommendedModel} downloaded successfully`);
      
    } catch (error) {
      throw new Error(`Failed to download model: ${error}`);
    }
  }

  private async testSetup(): Promise<void> {
    console.log('🧪 Testing LLM setup...');
    
    const testPrompt = 'Analyze this text for PII: "John Smith lives at 123 Main St and his phone is 555-1234"';
    
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.recommendedModel,
          prompt: testPrompt,
          stream: false,
          options: {
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Test failed: ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      if (result.response) {
        console.log('✅ LLM test successful');
        console.log(`   Sample response: ${result.response.substring(0, 100)}...`);
      } else {
        throw new Error('No response from LLM');
      }
      
    } catch (error) {
      throw new Error(`LLM test failed: ${error}`);
    }
  }

  private updateEnvironmentConfig(): void {
    console.log('\n🔧 Environment Configuration:');
    console.log('Add these variables to your .env file for optimal performance:');
    console.log('');
    console.log('# Local LLM Configuration');
    console.log(`OLLAMA_URL=${this.ollamaUrl}`);
    console.log(`LOCAL_LLM_MODEL=${this.recommendedModel}`);
    console.log('ENABLE_LOCAL_LLM=true');
    console.log('');
    console.log('# Optional: Adjust LLM analysis settings');
    console.log('LLM_ANALYSIS_TIMEOUT=10000  # 10 seconds');
    console.log('LLM_BATCH_SIZE=5            # Process 5 documents at once');
    console.log('');
  }

  private printManualInstructions(): void {
    console.log('\n📋 Manual Installation Instructions:');
    console.log('');
    console.log('1. Install Ollama:');
    console.log('   macOS: brew install ollama');
    console.log('   Linux: curl -fsSL https://ollama.ai/install.sh | sh');
    console.log('   Windows: Download from https://ollama.ai/download/windows');
    console.log('');
    console.log('2. Start Ollama service:');
    console.log('   ollama serve');
    console.log('');
    console.log('3. Download the model:');
    console.log(`   ollama pull ${this.recommendedModel}`);
    console.log('');
    console.log('4. Test the installation:');
    console.log('   ollama run llama3.2:1b "Hello, world!"');
    console.log('');
    console.log('5. Add environment variables to .env:');
    console.log(`   OLLAMA_URL=${this.ollamaUrl}`);
    console.log(`   LOCAL_LLM_MODEL=${this.recommendedModel}`);
    console.log('   ENABLE_LOCAL_LLM=true');
  }
}

// Run setup if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new LocalLLMSetup();
  setup.setup().catch(console.error);
}

export { LocalLLMSetup };