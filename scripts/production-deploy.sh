#!/bin/bash

# Production Deployment Script for ReadMyFinePrint
# This script handles production deployment with monitoring

set -e  # Exit on any error

echo "🚀 Starting ReadMyFinePrint Production Deployment..."

# Check if we're in production environment
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  Warning: NODE_ENV is not set to 'production'"
    echo "   Current NODE_ENV: ${NODE_ENV:-'not set'}"
    echo "   Setting NODE_ENV=production for this deployment"
    export NODE_ENV=production
fi

# Validate required environment variables
echo "🔍 Validating production environment..."

REQUIRED_VARS=(
    "DATABASE_URL"
    "OPENAI_API_KEY"
    "ADMIN_API_KEY"
    "JWT_SECRET"
    "TOKEN_ENCRYPTION_KEY"
    "PASSWORD_PEPPER"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please set these environment variables before deploying to production."
    exit 1
fi

echo "✅ Environment validation passed"

# Build the application
echo "🏗️  Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Run production health check
echo "🔍 Running pre-deployment health check..."
timeout 30 npm run monitor || {
    echo "⚠️  Pre-deployment health check failed or timed out"
    echo "   This might be normal if the server isn't running yet"
}

# Start production server
echo "🚀 Starting production server..."

# Create monitoring log directory
mkdir -p /tmp/monitoring

# Start the production server in the background
npm run start &
SERVER_PID=$!

echo "📋 Production server started with PID: $SERVER_PID"

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

# Run health check to verify deployment
echo "🔍 Running post-deployment health check..."
if npm run monitor; then
    echo "✅ Production deployment successful!"
    echo "🌐 Server is running and healthy"
    
    # Start continuous monitoring if requested
    if [ "$START_MONITORING" = "true" ]; then
        echo "📊 Starting continuous monitoring..."
        npm run monitor:continuous &
        MONITOR_PID=$!
        echo "📈 Monitoring started with PID: $MONITOR_PID"
    fi
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo "   Server PID: $SERVER_PID"
    if [ -n "$MONITOR_PID" ]; then
        echo "   Monitor PID: $MONITOR_PID"
    fi
    echo "   Logs: Check your deployment platform's log viewer"
    echo "   Health: npm run monitor"
    echo ""
    
    # Keep the script running to maintain the server
    wait $SERVER_PID
    
else
    echo "❌ Post-deployment health check failed"
    echo "🛑 Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi 