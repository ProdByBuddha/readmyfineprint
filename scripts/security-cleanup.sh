#!/bin/bash

# Security Cleanup Script for ReadMyFinePrint
# This script removes sensitive information from the codebase

echo "🔒 Starting security cleanup..."

# 1. Remove any remaining build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf dist/
rm -rf build/
rm -rf out/
rm -rf .next/
rm -rf coverage/

# 2. Remove any temporary files
echo "🧹 Cleaning temporary files..."
rm -rf temp/
rm -rf tmp/
rm -f *.tmp
rm -f *.temp
rm -f *.log
rm -f *.backup
rm -f *.bak

# 3. Remove any potential secret files
echo "🧹 Cleaning potential secret files..."
rm -f secrets.json
rm -f config.json
rm -f settings.json
rm -f credentials.json
rm -f auth.json
rm -f .env.*
rm -f *.key
rm -f *.pem
rm -f *.p12
rm -f *.pfx

# 4. Clean up OS files
echo "🧹 Cleaning OS files..."
find . -name ".DS_Store" -delete
find . -name "Thumbs.db" -delete
find . -name "Desktop.ini" -delete

# 5. Remove any debug or report files
echo "🧹 Cleaning debug files..."
rm -f debug.log
rm -f error.log
rm -f access.log
rm -f security-report.*
rm -f vulnerability-report.*
rm -f audit-report.*

# 6. Check for any remaining hardcoded secrets
echo "🔍 Checking for remaining secrets..."
echo "Checking for API keys..."
if grep -r "sk_" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=scripts | grep -v "process.env" | grep -v ".env"; then
    echo "❌ Found hardcoded secret keys!"
    exit 1
fi

echo "Checking for Stripe keys..."
if grep -r "pk_live_" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=scripts; then
    echo "❌ Found hardcoded Stripe live keys!"
    exit 1
fi

echo "Checking for OpenAI keys..."
if grep -r "sk-" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=scripts | grep -v "process.env" | grep -v ".env"; then
    echo "❌ Found hardcoded OpenAI keys!"
    exit 1
fi

echo "✅ Security cleanup completed successfully!"
echo "✅ No hardcoded secrets found in source code!"
echo ""
echo "📋 Security checklist:"
echo "✅ Build artifacts removed"
echo "✅ Temporary files cleaned"
echo "✅ Secret files removed"
echo "✅ OS files cleaned"
echo "✅ Debug files removed"
echo "✅ No hardcoded secrets in source code"
echo ""
echo "🔐 Remember to:"
echo "  - Set up proper .env files with your actual secrets"
echo "  - Never commit .env files to version control"
echo "  - Use environment variables for all sensitive data"
echo "  - Regularly rotate your API keys"
echo "  - Monitor for any accidental secret commits"