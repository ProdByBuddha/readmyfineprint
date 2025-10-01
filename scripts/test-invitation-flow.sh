#!/bin/bash

# Test script for the complete invitation flow
# This tests both backend API and ensures frontend route is accessible

set -e

echo "🧪 Testing Invitation System Flow"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:5000"
API_URL="$BASE_URL/api"

echo "📋 Prerequisites:"
echo "  - Server must be running on port 5000"
echo "  - You need admin access to an organization"
echo "  - Test email will be sent to configured email service"
echo ""

# Function to make API request
api_request() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data" \
            "$API_URL$endpoint"
    else
        curl -s -X "$method" \
            -H "Authorization: Bearer $token" \
            "$API_URL$endpoint"
    fi
}

echo "🔐 Step 1: Authentication"
echo "-------------------------"
echo "Please provide admin credentials for testing:"
read -p "Admin email: " ADMIN_EMAIL
read -sp "Admin password: " ADMIN_PASSWORD
echo ""

# Login as admin
echo "Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "$API_URL/auth/login")

ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token // empty')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Admin logged in successfully${NC}"
echo ""

echo "🏢 Step 2: Get or Create Organization"
echo "--------------------------------------"

# Try to get existing organizations
ORGS_RESPONSE=$(api_request "GET" "/orgs" "$ADMIN_TOKEN")
echo "Organizations response: $ORGS_RESPONSE"

ORG_ID=$(echo $ORGS_RESPONSE | jq -r '.organizations[0].id // empty')

if [ -z "$ORG_ID" ] || [ "$ORG_ID" = "null" ]; then
    echo "No organization found. Creating test organization..."
    
    CREATE_ORG_RESPONSE=$(api_request "POST" "/orgs" "$ADMIN_TOKEN" \
        '{"name":"Test Organization","slug":"test-org-'$(date +%s)'"}')
    
    ORG_ID=$(echo $CREATE_ORG_RESPONSE | jq -r '.organization.id // empty')
    
    if [ -z "$ORG_ID" ] || [ "$ORG_ID" = "null" ]; then
        echo -e "${RED}❌ Failed to create organization${NC}"
        echo "Response: $CREATE_ORG_RESPONSE"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Organization created: $ORG_ID${NC}"
else
    echo -e "${GREEN}✅ Using existing organization: $ORG_ID${NC}"
fi

ORG_NAME=$(echo $ORGS_RESPONSE | jq -r '.organizations[0].name // "Test Organization"')
echo "Organization name: $ORG_NAME"
echo ""

echo "✉️  Step 3: Create Invitation"
echo "-----------------------------"
read -p "Email to invite (test user): " INVITE_EMAIL
read -p "Role (admin/member/viewer) [member]: " INVITE_ROLE
INVITE_ROLE=${INVITE_ROLE:-member}

echo "Creating invitation for $INVITE_EMAIL as $INVITE_ROLE..."

INVITATION_RESPONSE=$(api_request "POST" "/orgs/$ORG_ID/invitations" "$ADMIN_TOKEN" \
    "{\"email\":\"$INVITE_EMAIL\",\"role\":\"$INVITE_ROLE\"}")

echo "Invitation response: $INVITATION_RESPONSE"

INVITATION_ID=$(echo $INVITATION_RESPONSE | jq -r '.invitation.id // empty')

if [ -z "$INVITATION_ID" ] || [ "$INVITATION_ID" = "null" ]; then
    echo -e "${RED}❌ Failed to create invitation${NC}"
    echo "Response: $INVITATION_RESPONSE"
    
    # Check if it's a duplicate or seat limit issue
    ERROR_CODE=$(echo $INVITATION_RESPONSE | jq -r '.code // empty')
    if [ "$ERROR_CODE" = "INVITATION_EXISTS" ]; then
        echo -e "${YELLOW}⚠️  Invitation already exists for this email${NC}"
    elif [ "$ERROR_CODE" = "SEAT_LIMIT_REACHED" ]; then
        echo -e "${YELLOW}⚠️  Organization seat limit reached${NC}"
    fi
    exit 1
fi

echo -e "${GREEN}✅ Invitation created: $INVITATION_ID${NC}"
echo ""

echo "📧 Step 4: Email Should Be Sent"
echo "--------------------------------"
echo -e "${YELLOW}⚠️  Check the email inbox for $INVITE_EMAIL${NC}"
echo "The invitation email should contain:"
echo "  - Organization name: $ORG_NAME"
echo "  - Role: $INVITE_ROLE"
echo "  - Invitation link with token"
echo "  - Expiration date (7 days from now)"
echo ""
read -p "Press Enter once you've confirmed the email was sent..."

echo ""
echo "📋 Step 5: List Pending Invitations"
echo "------------------------------------"

INVITATIONS_LIST=$(api_request "GET" "/orgs/$ORG_ID/invitations" "$ADMIN_TOKEN")
echo "Pending invitations:"
echo $INVITATIONS_LIST | jq '.invitations[] | {email, role, expiresAt}'
echo ""

echo "🔗 Step 6: Test Invitation Token Lookup"
echo "----------------------------------------"
echo "Note: We can't extract the token from the email in this script"
echo "Please check the invitation email and copy the token from the URL"
echo "Example: http://localhost:5173/invite/TOKEN_HERE"
echo ""
read -p "Enter the invitation token from the email: " INVITATION_TOKEN

if [ -z "$INVITATION_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  No token provided, skipping token validation${NC}"
else
    echo "Testing invitation lookup (no auth required)..."
    INVITATION_DETAILS=$(curl -s -X GET "$API_URL/invitations/$INVITATION_TOKEN")
    
    if echo $INVITATION_DETAILS | jq -e '.organization' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Invitation token is valid${NC}"
        echo "Details:"
        echo $INVITATION_DETAILS | jq '{organization: .organization.name, role, email, expiresAt}'
        
        echo ""
        echo "🌐 Frontend URL:"
        echo -e "${GREEN}http://localhost:5173/invite/$INVITATION_TOKEN${NC}"
        echo ""
        echo "You can now:"
        echo "  1. Open this URL in a browser"
        echo "  2. Sign in as $INVITE_EMAIL (or create account if new)"
        echo "  3. Accept the invitation"
        echo "  4. You should be added to the organization"
    else
        echo -e "${RED}❌ Invalid token or invitation not found${NC}"
        echo "Response: $INVITATION_DETAILS"
    fi
fi

echo ""
echo "🧹 Step 7: Cleanup (Optional)"
echo "-----------------------------"
read -p "Do you want to revoke the invitation? (y/N): " REVOKE

if [ "$REVOKE" = "y" ] || [ "$REVOKE" = "Y" ]; then
    echo "Revoking invitation..."
    REVOKE_RESPONSE=$(api_request "DELETE" "/orgs/$ORG_ID/invitations/$INVITATION_ID" "$ADMIN_TOKEN")
    
    if echo $REVOKE_RESPONSE | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Invitation revoked${NC}"
    else
        echo -e "${RED}❌ Failed to revoke invitation${NC}"
        echo "Response: $REVOKE_RESPONSE"
    fi
fi

echo ""
echo "✅ Invitation Flow Test Complete!"
echo "=================================="
echo ""
echo "Summary:"
echo "  - Organization: $ORG_NAME ($ORG_ID)"
echo "  - Invitation sent to: $INVITE_EMAIL"
echo "  - Role: $INVITE_ROLE"
echo "  - Invitation ID: $INVITATION_ID"
echo ""
echo "Next steps:"
echo "  1. Check email inbox for invitation"
echo "  2. Visit the invitation URL in browser"
echo "  3. Sign in and accept the invitation"
echo "  4. Verify user is added to organization"
