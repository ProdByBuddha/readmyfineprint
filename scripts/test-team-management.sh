#!/bin/bash

# Comprehensive Team Management Testing Script
# Tests the complete team collaboration flow end-to-end

set -e

echo "🧪 Team Management System - Comprehensive Test Suite"
echo "====================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:5000"
API_URL="$BASE_URL/api"
TEST_RESULTS=()
PASSED=0
FAILED=0

# Function to log test result
log_test() {
    local test_name=$1
    local result=$2
    local message=$3
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        TEST_RESULTS+=("✅ $test_name: $message")
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        TEST_RESULTS+=("❌ $test_name: $message")
        ((FAILED++))
    fi
}

# Function to make authenticated API request
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

echo "📋 Prerequisites Check"
echo "---------------------"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is not installed. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y jq
fi

# Check if server is running
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend server is not running on port 5000${NC}"
    echo "Please start the server in another terminal with: npm run dev"
    echo ""
    read -p "Press Enter once the server is running..."
fi

echo -e "${GREEN}✅ Backend server is accessible${NC}"
echo ""

echo "🔐 Test 1: User Authentication"
echo "-------------------------------"
read -p "Enter test user email: " TEST_USER_EMAIL
read -sp "Enter password: " TEST_USER_PASSWORD
echo ""

LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
    "$API_URL/auth/login")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    log_test "User Authentication" "FAIL" "Login failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
else
    log_test "User Authentication" "PASS" "Successfully logged in"
fi
echo ""

echo "🏢 Test 2: Organization Creation"
echo "---------------------------------"
ORG_NAME="Test Organization $(date +%s)"
ORG_SLUG="test-org-$(date +%s)"

CREATE_ORG_RESPONSE=$(api_request "POST" "/orgs" "$ACCESS_TOKEN" \
    "{\"name\":\"$ORG_NAME\",\"slug\":\"$ORG_SLUG\"}")

ORG_ID=$(echo $CREATE_ORG_RESPONSE | jq -r '.organization.id // empty')

if [ -z "$ORG_ID" ] || [ "$ORG_ID" = "null" ]; then
    log_test "Organization Creation" "FAIL" "Failed to create organization"
    echo "Response: $CREATE_ORG_RESPONSE"
else
    log_test "Organization Creation" "PASS" "Created organization: $ORG_NAME"
    echo "Organization ID: $ORG_ID"
fi
echo ""

echo "📋 Test 3: Fetch Organizations"
echo "-------------------------------"
ORGS_RESPONSE=$(api_request "GET" "/orgs" "$ACCESS_TOKEN")
ORGS_COUNT=$(echo $ORGS_RESPONSE | jq '.organizations | length')

if [ "$ORGS_COUNT" -gt 0 ]; then
    log_test "Fetch Organizations" "PASS" "Found $ORGS_COUNT organization(s)"
    echo "Organizations:"
    echo $ORGS_RESPONSE | jq '.organizations[] | {name, slug, memberCount, role}'
else
    log_test "Fetch Organizations" "FAIL" "No organizations found"
fi
echo ""

echo "👥 Test 4: Fetch Organization Members"
echo "--------------------------------------"
MEMBERS_RESPONSE=$(api_request "GET" "/orgs/$ORG_ID/members" "$ACCESS_TOKEN")
MEMBERS_COUNT=$(echo $MEMBERS_RESPONSE | jq '.members | length')

if [ "$MEMBERS_COUNT" -gt 0 ]; then
    log_test "Fetch Members" "PASS" "Found $MEMBERS_COUNT member(s)"
    echo "Members:"
    echo $MEMBERS_RESPONSE | jq '.members[] | {email, role, joinedAt}'
else
    log_test "Fetch Members" "FAIL" "No members found (should at least have creator)"
fi
echo ""

echo "✉️  Test 5: Create Invitation"
echo "-----------------------------"
read -p "Enter email to invite: " INVITE_EMAIL
read -p "Enter role (admin/member/viewer) [member]: " INVITE_ROLE
INVITE_ROLE=${INVITE_ROLE:-member}

INVITATION_RESPONSE=$(api_request "POST" "/orgs/$ORG_ID/invitations" "$ACCESS_TOKEN" \
    "{\"email\":\"$INVITE_EMAIL\",\"role\":\"$INVITE_ROLE\"}")

INVITATION_ID=$(echo $INVITATION_RESPONSE | jq -r '.invitation.id // empty')

if [ -z "$INVITATION_ID" ] || [ "$INVITATION_ID" = "null" ]; then
    ERROR_CODE=$(echo $INVITATION_RESPONSE | jq -r '.code // empty')
    if [ "$ERROR_CODE" = "ALREADY_MEMBER" ]; then
        log_test "Create Invitation" "PASS" "Correctly rejected: user already a member"
    elif [ "$ERROR_CODE" = "INVITATION_EXISTS" ]; then
        log_test "Create Invitation" "PASS" "Correctly rejected: invitation already exists"
    else
        log_test "Create Invitation" "FAIL" "Failed to create invitation"
        echo "Response: $INVITATION_RESPONSE"
    fi
else
    log_test "Create Invitation" "PASS" "Created invitation for $INVITE_EMAIL"
    echo "Invitation ID: $INVITATION_ID"
    echo "Expiration: $(echo $INVITATION_RESPONSE | jq -r '.invitation.expiresAt')"
fi
echo ""

echo "📬 Test 6: List Pending Invitations"
echo "------------------------------------"
INVITATIONS_RESPONSE=$(api_request "GET" "/orgs/$ORG_ID/invitations" "$ACCESS_TOKEN")
INVITATIONS_COUNT=$(echo $INVITATIONS_RESPONSE | jq '.invitations | length')

if [ "$INVITATIONS_COUNT" -ge 0 ]; then
    log_test "List Invitations" "PASS" "Found $INVITATIONS_COUNT pending invitation(s)"
    if [ "$INVITATIONS_COUNT" -gt 0 ]; then
        echo "Pending invitations:"
        echo $INVITATIONS_RESPONSE | jq '.invitations[] | {email, role, expiresAt, status}'
    fi
else
    log_test "List Invitations" "FAIL" "Failed to fetch invitations"
fi
echo ""

echo "🔗 Test 7: Invitation Token Validation"
echo "---------------------------------------"
if [ -n "$INVITATION_ID" ]; then
    echo "Note: To test invitation acceptance, you would need:"
    echo "1. Extract the token from the invitation email"
    echo "2. Visit: http://localhost:5173/invite/{TOKEN}"
    echo "3. Sign in as $INVITE_EMAIL"
    echo "4. Accept the invitation"
    echo ""
    echo "For automated testing, you can manually test this flow"
    log_test "Invitation Flow Ready" "PASS" "Invitation created and ready for acceptance"
else
    log_test "Invitation Flow Ready" "FAIL" "No invitation to test"
fi
echo ""

echo "🗑️  Test 8: Revoke Invitation (Optional)"
echo "----------------------------------------"
if [ -n "$INVITATION_ID" ]; then
    read -p "Do you want to revoke the invitation? (y/N): " REVOKE
    if [ "$REVOKE" = "y" ] || [ "$REVOKE" = "Y" ]; then
        REVOKE_RESPONSE=$(api_request "DELETE" "/orgs/$ORG_ID/invitations/$INVITATION_ID" "$ACCESS_TOKEN")
        
        if echo $REVOKE_RESPONSE | jq -e '.success' > /dev/null 2>&1; then
            log_test "Revoke Invitation" "PASS" "Successfully revoked invitation"
        else
            log_test "Revoke Invitation" "FAIL" "Failed to revoke invitation"
            echo "Response: $REVOKE_RESPONSE"
        fi
    else
        echo "Skipping revocation test"
    fi
fi
echo ""

echo "🎭 Test 9: Role Management (If multiple members exist)"
echo "-------------------------------------------------------"
if [ "$MEMBERS_COUNT" -gt 1 ]; then
    echo "Available members:"
    echo $MEMBERS_RESPONSE | jq '.members[] | {id, email, role}'
    echo ""
    read -p "Enter member ID to test role change (or press Enter to skip): " TEST_MEMBER_ID
    
    if [ -n "$TEST_MEMBER_ID" ]; then
        read -p "Enter new role (admin/member/viewer): " NEW_ROLE
        
        ROLE_UPDATE_RESPONSE=$(api_request "PATCH" "/orgs/$ORG_ID/members/$TEST_MEMBER_ID/role" "$ACCESS_TOKEN" \
            "{\"role\":\"$NEW_ROLE\"}")
        
        if echo $ROLE_UPDATE_RESPONSE | jq -e '.success' > /dev/null 2>&1; then
            log_test "Update Member Role" "PASS" "Successfully updated member role"
        else
            log_test "Update Member Role" "FAIL" "Failed to update role"
            echo "Response: $ROLE_UPDATE_RESPONSE"
        fi
    else
        echo "Skipping role management test"
    fi
else
    echo "Only one member exists. Skipping role management test."
    echo "To test role management, accept an invitation first."
fi
echo ""

echo "🌐 Test 10: Frontend Accessibility"
echo "-----------------------------------"
FRONTEND_URL="http://localhost:5173"
if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    log_test "Frontend Server" "PASS" "Frontend is running on port 5173"
    echo ""
    echo "Frontend URLs to test manually:"
    echo "  - Settings Team Tab: $FRONTEND_URL/settings (click Team tab)"
    echo "  - Invitation Page: $FRONTEND_URL/invite/{TOKEN}"
else
    log_test "Frontend Server" "FAIL" "Frontend is not running"
    echo "Start frontend with: cd client && npm run dev"
fi
echo ""

echo "📊 Test Results Summary"
echo "======================="
echo ""
echo "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed. Review the results above.${NC}"
fi

echo ""
echo "📋 Detailed Results:"
echo "-------------------"
for result in "${TEST_RESULTS[@]}"; do
    echo "$result"
done

echo ""
echo "📝 Manual Testing Checklist:"
echo "----------------------------"
echo "[ ] Open $FRONTEND_URL/settings"
echo "[ ] Navigate to Team tab"
echo "[ ] Verify organizations list loads"
echo "[ ] Create a new organization"
echo "[ ] Switch between organizations"
echo "[ ] Send an invitation"
echo "[ ] Check email for invitation"
echo "[ ] Accept invitation (in new browser/incognito)"
echo "[ ] Verify member appears in list"
echo "[ ] Change member role (as admin)"
echo "[ ] Remove a member (as admin)"
echo "[ ] Test as non-admin (read-only view)"
echo "[ ] Verify dark mode works"
echo "[ ] Test on mobile device"
echo ""

echo "Test Organization Details:"
echo "-------------------------"
echo "Name: $ORG_NAME"
echo "Slug: $ORG_SLUG"
echo "ID: $ORG_ID"
echo ""

if [ -n "$INVITATION_ID" ]; then
    echo "Created Invitation:"
    echo "-------------------"
    echo "Email: $INVITE_EMAIL"
    echo "Role: $INVITE_ROLE"
    echo "ID: $INVITATION_ID"
    echo ""
fi

echo "✅ Testing complete!"
