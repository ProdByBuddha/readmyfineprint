#!/bin/bash

# Deployment Fix Script for TailwindCSS Issues
# This script ensures all dependencies are properly installed and fixes common deployment issues

echo "🚀 Starting TailwindCSS deployment fix..."

# Step 1: Install all required dependencies
echo "📦 Installing CSS processing dependencies..."
npm install --save-dev tailwindcss postcss autoprefixer postcss-load-config arg @tailwindcss/vite

# Step 2: Verify installations
echo "🔍 Verifying installations..."

if [ -f "./node_modules/.bin/tailwindcss" ]; then
    echo "✅ Local TailwindCSS binary found"
else
    echo "❌ Local TailwindCSS binary not found"
    exit 1
fi

# Step 3: Test CSS processing
echo "🎨 Testing CSS processing..."
mkdir -p dist/public

# Try local tailwindcss first
if ./node_modules/.bin/tailwindcss -i ./client/src/index.css -o ./dist/public/styles.css --minify; then
    echo "✅ CSS processing with local TailwindCSS successful"
elif npx tailwindcss -i ./client/src/index.css -o ./dist/public/styles.css --minify; then
    echo "✅ CSS processing with npx TailwindCSS successful"
else
    echo "❌ CSS processing failed with both methods"
    exit 1
fi

echo "🎉 TailwindCSS deployment fix completed successfully!"