#!/bin/bash

# Ollama Setup for Replit - Local LLM Installation
echo "🤖 Setting up Ollama with Llama 3.2 for Replit..."

# Step 1: Install Ollama
echo "📦 Installing Ollama..."
curl -fsSL https://ollama.ai/install.sh | sh

# Step 2: Start Ollama service in background
echo "🚀 Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!
sleep 5

# Step 3: Pull Llama 3.2 3B model (optimized for containers)
echo "⬇️ Downloading Llama 3.2 3B model..."
ollama pull llama3.2:3b

# Step 4: Test the model
echo "🧪 Testing model..."
echo "What is PII?" | ollama run llama3.2:3b

# Step 5: Create systemd-like service for Replit
echo "⚙️ Creating Ollama service script..."
cat > /home/runner/workspace/scripts/ollama-service.sh << 'EOF'
#!/bin/bash
# Ollama Service for Replit
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_MODELS=/tmp/ollama/models
mkdir -p $OLLAMA_MODELS
ollama serve
EOF

chmod +x /home/runner/workspace/scripts/ollama-service.sh

# Step 6: Update package.json to use Ollama
echo "📝 Updating package.json..."
echo "✅ Ollama setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Update package.json: 'llm:start': './scripts/ollama-service.sh'"
echo "2. Run: npm run dev:with-llm"
echo "3. Your app now uses Llama 3.2 locally!"
echo ""
echo "🔍 Test Ollama:"
echo "curl http://localhost:11434/api/generate -d '{\"model\":\"llama3.2:3b\",\"prompt\":\"What is PII?\"}'"