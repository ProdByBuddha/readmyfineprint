#!/bin/bash

# Kill processes using port 3000
echo "Cleaning up processes on port 3000..."

# Method 1: Kill Next.js processes specifically
echo "Step 1: Killing Next.js processes..."
pkill -f 'next-server' 2>/dev/null || true
pkill -f 'next start' 2>/dev/null || true

# Method 2: Skip lsof (causes hanging)
echo "Step 2: Skipping lsof check..."

# Method 3: Double-check with pkill
echo "Step 3: Final cleanup..."
pkill -9 -f 'node.*next' 2>/dev/null || true

# Wait a moment for processes to terminate
echo "Step 4: Waiting for cleanup..."
sleep 1

echo "Cleanup complete"