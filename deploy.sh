#!/bin/bash

echo "🚀 Building ReadMyFinePrint for deployment..."

# Clear previous build
rm -rf dist/public

# Build frontend with memory optimization
echo "📦 Building frontend..."
NODE_OPTIONS="--max-old-space-size=4096" npx vite build --mode production

# Check if build succeeded
if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Frontend build failed - index.html not found"
    exit 1
fi

echo "🔧 Building backend..."
npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Verify backend build
if [ ! -f "dist/production.js" ]; then
    echo "❌ Backend build failed"
    exit 1
fi

echo "✅ Build complete!"
echo "📁 Frontend files: $(ls -la dist/public/ | wc -l) files"
echo "📁 Backend file: dist/production.js"
echo ""
echo "🚀 To start production server:"
echo "NODE_ENV=production node dist/production.js"