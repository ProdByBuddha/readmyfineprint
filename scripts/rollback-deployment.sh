#!/bin/bash

# Rollback Deployment Script for ReadMyFinePrint
# This script provides quick rollback capabilities for Replit deployments

set -e

echo "🔄 ReadMyFinePrint Deployment Rollback"

# Check current environment
CURRENT_ENV=${NODE_ENV:-development}
echo "📍 Current environment: $CURRENT_ENV"

# Function to rollback to previous deployment
rollback_to_previous() {
    echo "⏪ Rolling back to previous deployment..."
    
    # Stop current processes
    echo "🛑 Stopping current processes..."
    pkill -f "tsx server" || true
    pkill -f "local-llm-server" || true
    pkill -f "production-monitor" || true
    
    # Wait for processes to stop
    sleep 3
    
    # Start previous stable version (development mode)
    echo "🚀 Starting rollback version..."
    npm run dev &
    ROLLBACK_PID=$!
    
    echo "⏳ Waiting for rollback server to start..."
    sleep 10
    
    # Health check on rollback
    echo "🔍 Running health check on rollback..."
    if npm run monitor; then
        echo "✅ Rollback successful!"
        echo "🌐 Server is running on development mode"
        echo "📋 Process PID: $ROLLBACK_PID"
    else
        echo "❌ Rollback health check failed"
        kill $ROLLBACK_PID 2>/dev/null || true
        exit 1
    fi
}

# Function to rollback staging deployment
rollback_staging() {
    echo "⏪ Rolling back staging deployment..."
    
    # Stop staging processes
    pkill -f "NODE_ENV=staging" || true
    sleep 3
    
    # Start development version
    echo "🚀 Starting development version..."
    npm run dev &
    echo "✅ Rolled back staging to development"
}

# Function to rollback production deployment
rollback_production() {
    echo "⏪ Rolling back production deployment..."
    echo "⚠️  This will switch to staging mode as fallback"
    
    # Stop production processes
    pkill -f "server/production.ts" || true
    pkill -f "monitor:production:continuous" || true
    sleep 5
    
    # Start staging as fallback
    echo "🚀 Starting staging as production fallback..."
    NODE_ENV=staging npm run start:staging &
    echo "✅ Rolled back production to staging mode"
}

# Main rollback logic
case "$1" in
    "staging")
        rollback_staging
        ;;
    "production")
        rollback_production
        ;;
    "previous"|"")
        rollback_to_previous
        ;;
    "help")
        echo "Usage: $0 [staging|production|previous|help]"
        echo ""
        echo "Options:"
        echo "  staging     - Rollback staging deployment to development"
        echo "  production  - Rollback production to staging"
        echo "  previous    - Rollback to previous stable version (default)"
        echo "  help        - Show this help message"
        ;;
    *)
        echo "❌ Unknown rollback target: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac

echo ""
echo "🎉 Rollback Complete!"
echo "💡 To restart normal deployment, use:"
echo "   - npm run dev (development)"
echo "   - npm run deploy:staging (staging)"
echo "   - npm run deploy:production (production)"