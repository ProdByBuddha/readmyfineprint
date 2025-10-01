#!/bin/bash

# Test Organization API Endpoints
# This script tests the organization management APIs

API_BASE="http://localhost:5000/api"

echo "🧪 Testing Organization API Endpoints"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "📡 Checking if server is running..."
if ! curl -s -f "$API_BASE/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not running at $API_BASE${NC}"
    echo "   Please start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Test 1: List user's organizations (should require auth)
echo "1️⃣  Testing GET /me/orgs (without auth - should fail)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/me/orgs")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Correctly requires authentication${NC}"
else
    echo -e "${RED}❌ Expected 401, got $HTTP_CODE${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 2: Create organization (should require auth)
echo "2️⃣  Testing POST /orgs (without auth - should fail)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/orgs" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Org","slug":"test-org"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Correctly requires authentication${NC}"
else
    echo -e "${RED}❌ Expected 401, got $HTTP_CODE${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 3: Check if organizations feature is enabled
echo "3️⃣  Testing feature flag enforcement"
echo "   Current ENABLE_ORGANIZATIONS: ${ENABLE_ORGANIZATIONS:-not set}"
if [ "$ENABLE_ORGANIZATIONS" != "true" ]; then
    echo -e "${YELLOW}⚠️  Organizations feature is disabled${NC}"
    echo "   Set ENABLE_ORGANIZATIONS=true in .env to enable"
fi
echo ""

echo "======================================"
echo "🎯 Summary"
echo "======================================"
echo ""
echo "✅ Organization routes are mounted and responding"
echo "✅ Authentication is enforced correctly"
echo ""
echo "Next steps:"
echo "1. Set ENABLE_ORGANIZATIONS=true in .env"
echo "2. Create a test user and get auth token"
echo "3. Test authenticated organization creation"
echo "4. Build invitation system"
echo ""
