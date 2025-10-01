# 🧪 Team Management System - Testing Guide

## Overview

This guide provides comprehensive instructions for testing the complete team collaboration system, including backend APIs, frontend UI, and end-to-end workflows.

## Prerequisites

### Required Software
- ✅ Node.js (installed via nvm-windows)
- ✅ npm
- ✅ PostgreSQL database
- ✅ Email service configured (for invitation emails)
- ✅ jq (JSON processor) - will be installed automatically by test script

### Environment Setup
1. Ensure `.env` file is properly configured
2. Database is running and migrations are applied
3. Email service credentials are set

## Test Execution Methods

### Method 1: Automated API Testing (Recommended for Backend)

**Run the automated test script:**

```bash
./scripts/test-team-management.sh
```

**What it tests:**
1. ✅ User authentication
2. ✅ Organization creation
3. ✅ Fetching organizations
4. ✅ Fetching members
5. ✅ Creating invitations
6. ✅ Listing invitations
7. ✅ Invitation flow readiness
8. ✅ Revoking invitations
9. ✅ Role management
10. ✅ Frontend accessibility

**Expected Output:**
- Green ✅ for passed tests
- Red ❌ for failed tests
- Summary with pass/fail counts
- Manual testing checklist

### Method 2: Manual Frontend Testing (Recommended for UI)

#### Step 1: Start the Servers

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client && npm run dev
```

#### Step 2: Access the Application

Open your browser and navigate to: `http://localhost:5173`

#### Step 3: Test Team Management UI

**Test Case 1: Organization Creation**
1. Sign in to your account
2. Navigate to Settings > Team tab
3. Click "Create Organization"
4. Enter organization name (e.g., "Acme Corp")
5. Verify slug auto-generates (e.g., "acme-corp")
6. Click "Create Organization"

**Expected Result:**
- ✅ Success toast appears
- ✅ Organization appears in list
- ✅ Organization is auto-selected
- ✅ Your role shows as "admin"
- ✅ Member count shows "1"

---

**Test Case 2: Send Invitation**
1. With an organization selected, click "New Invitation"
2. Enter a valid email address
3. Select a role (member/admin/viewer)
4. Click "Send Invitation"

**Expected Result:**
- ✅ Success toast: "Invitation sent!"
- ✅ Invitation appears in "Pending Invitations" section
- ✅ Shows correct email and role
- ✅ Shows expiration time ("Expires in X days")
- ✅ Email is sent to the invited user

---

**Test Case 3: View Pending Invitations**
1. Scroll to "Pending Invitations" section
2. Verify all pending invitations are listed
3. Check email, role badges, and expiration times

**Expected Result:**
- ✅ All invitations display correctly
- ✅ Role badges are color-coded
- ✅ Expiration countdown is accurate
- ✅ Expired invitations show "Expired" text

---

**Test Case 4: Accept Invitation**
1. Check email for invitation
2. Click "Accept Invitation" in email
3. Opens `/invite/:token` page
4. Sign in (if not already)
5. Review invitation details
6. Click "Accept Invitation"

**Expected Result:**
- ✅ Invitation details display correctly
- ✅ Organization name, role, and email shown
- ✅ Success toast after acceptance
- ✅ Redirected to settings/dashboard
- ✅ User added to organization
- ✅ Member count increases

---

**Test Case 5: View Members List**
1. Return to Settings > Team tab
2. Select the organization
3. Scroll to "Team Members" section

**Expected Result:**
- ✅ All members listed
- ✅ Shows email and join date
- ✅ Email verification checkmark (if verified)
- ✅ Role badges displayed
- ✅ Admin can see role dropdowns
- ✅ Non-admin sees read-only badges

---

**Test Case 6: Change Member Role (Admin Only)**
1. As admin, open role dropdown for a member
2. Select a different role
3. Confirm change

**Expected Result:**
- ✅ Success toast: "Role updated"
- ✅ Role badge updates immediately
- ✅ Change persists after page refresh

---

**Test Case 7: Remove Member (Admin Only)**
1. Click trash icon next to a member
2. Confirm removal

**Expected Result:**
- ✅ Success toast: "Member removed"
- ✅ Member disappears from list
- ✅ Member count decreases
- ✅ User can no longer access organization

---

**Test Case 8: Revoke Invitation (Admin Only)**
1. In "Pending Invitations", click X button
2. Invitation removed

**Expected Result:**
- ✅ Success toast: "Invitation revoked"
- ✅ Invitation disappears from list
- ✅ Invitation token is invalid
- ✅ Email link no longer works

---

**Test Case 9: Switch Organizations**
1. If you belong to multiple organizations
2. Click on a different organization in the list
3. UI updates to show that organization's data

**Expected Result:**
- ✅ Organization is visually selected
- ✅ Members list updates
- ✅ Invitations list updates
- ✅ Permissions reflect your role in that org

---

**Test Case 10: Non-Admin View**
1. Sign in as a member or viewer
2. Navigate to Settings > Team tab

**Expected Result:**
- ✅ Cannot see "New Invitation" button
- ✅ Cannot see revoke buttons on invitations
- ✅ Cannot change member roles
- ✅ Cannot remove members
- ✅ Role badges are read-only
- ✅ Can view organizations and members

---

**Test Case 11: Dark Mode**
1. Toggle dark mode in settings
2. Navigate to Team tab

**Expected Result:**
- ✅ All components display correctly in dark mode
- ✅ Text is readable
- ✅ Badges have appropriate dark variants
- ✅ No visual glitches

---

**Test Case 12: Mobile Responsive**
1. Open DevTools, switch to mobile view
2. Navigate through team management

**Expected Result:**
- ✅ Layout adapts to mobile screen
- ✅ All buttons are accessible
- ✅ Forms are usable
- ✅ No horizontal scrolling
- ✅ Touch targets are appropriate size

---

### Method 3: API Testing with cURL/Postman

#### Authentication
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

#### Create Organization
```bash
curl -X POST http://localhost:5000/api/orgs \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","slug":"test-org"}'
```

#### List Organizations
```bash
curl http://localhost:5000/api/orgs \
  -H "Authorization: Bearer {token}"
```

#### Create Invitation
```bash
curl -X POST http://localhost:5000/api/orgs/{orgId}/invitations \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"email":"invite@example.com","role":"member"}'
```

#### List Members
```bash
curl http://localhost:5000/api/orgs/{orgId}/members \
  -H "Authorization: Bearer {token}"
```

## Common Issues & Solutions

### Issue 1: "Backend server is not running"
**Solution:** Start the backend server in a separate terminal:
```bash
npm run dev
```

### Issue 2: "Frontend is not running"
**Solution:** Start the frontend dev server:
```bash
cd client && npm run dev
```

### Issue 3: "Login failed"
**Solution:** 
- Verify user exists in database
- Check password is correct
- Ensure JWT secrets are configured in `.env`

### Issue 4: "Failed to create organization"
**Solution:**
- Check database is running
- Verify slug is unique
- Check user is authenticated

### Issue 5: "Invitation email not sent"
**Solution:**
- Check email service configuration in `.env`
- Verify SMTP credentials
- Check email service logs

### Issue 6: "Cannot access /api/orgs"
**Solution:**
- Verify organization routes are mounted in `server/routes.ts`
- Check feature flags are enabled
- Ensure user has proper permissions

### Issue 7: "TypeScript errors"
**Solution:**
```bash
npx tsc --noEmit
```
Fix any type errors shown

## Testing Checklist

### Backend API Tests
- [ ] ✅ User authentication works
- [ ] ✅ Organization CRUD operations
- [ ] ✅ Member management
- [ ] ✅ Invitation creation
- [ ] ✅ Invitation listing
- [ ] ✅ Invitation acceptance
- [ ] ✅ Invitation revocation
- [ ] ✅ Role updates
- [ ] ✅ Member removal
- [ ] ✅ Permission enforcement (RBAC)

### Frontend UI Tests
- [ ] ✅ Team tab loads without errors
- [ ] ✅ Organizations list displays
- [ ] ✅ Create organization dialog works
- [ ] ✅ Organization switching works
- [ ] ✅ Invite form validation
- [ ] ✅ Invitation creation
- [ ] ✅ Pending invitations display
- [ ] ✅ Members list displays
- [ ] ✅ Role badges show correctly
- [ ] ✅ Loading states appear
- [ ] ✅ Toast notifications work
- [ ] ✅ Error messages display
- [ ] ✅ Admin features visible to admins
- [ ] ✅ Admin features hidden from non-admins
- [ ] ✅ Dark mode works
- [ ] ✅ Mobile responsive

### Integration Tests
- [ ] ✅ End-to-end invitation flow
- [ ] ✅ Email delivery
- [ ] ✅ Token validation
- [ ] ✅ Member addition after acceptance
- [ ] ✅ Real-time UI updates
- [ ] ✅ Role changes persist
- [ ] ✅ Member removal works
- [ ] ✅ Multi-organization switching

### Security Tests
- [ ] ✅ Unauthenticated requests blocked
- [ ] ✅ Non-admin cannot create invitations
- [ ] ✅ Non-admin cannot change roles
- [ ] ✅ Non-admin cannot remove members
- [ ] ✅ Email verification on invitation acceptance
- [ ] ✅ Token expiration enforced
- [ ] ✅ One-time token use
- [ ] ✅ RBAC middleware working

## Performance Considerations

### Caching
- React Query caches for 1-5 minutes
- Stale data is automatically refetched
- Manual invalidation on mutations

### Optimizations
- Lazy loading of organization data
- Debounced search inputs
- Optimistic UI updates
- Pagination for large member lists (future)

## Test Data Cleanup

After testing, you may want to clean up test data:

```sql
-- Delete test organizations
DELETE FROM organizations WHERE slug LIKE 'test-org-%';

-- Delete pending invitations
DELETE FROM invitations WHERE status = 'pending' AND email LIKE 'test%';
```

## Reporting Issues

If you encounter issues during testing:

1. **Check the browser console** for errors
2. **Check the server logs** for backend errors
3. **Verify database state** with SQL queries
4. **Document the issue** with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - Console/server logs

## Success Criteria

The team management system is considered working if:

✅ All automated tests pass
✅ All manual UI tests pass
✅ Email invitations are sent successfully
✅ Invitation acceptance flow works end-to-end
✅ Role management works correctly
✅ Permissions are properly enforced
✅ UI is responsive and accessible
✅ Dark mode works
✅ No console errors
✅ No memory leaks
✅ Performance is acceptable

## Next Steps After Testing

Once all tests pass:

1. ✅ Document any bugs found
2. ✅ Fix critical issues
3. ✅ Deploy to staging environment
4. ✅ Conduct user acceptance testing
5. ✅ Move on to building Workspaces system

---

## Quick Start Testing

```bash
# 1. Start servers
npm run dev                  # Terminal 1: Backend
cd client && npm run dev     # Terminal 2: Frontend

# 2. Run automated tests
./scripts/test-team-management.sh

# 3. Manual UI testing
# Open http://localhost:5173/settings
# Click Team tab
# Follow test cases above

# 4. Clean up test data (optional)
# Run SQL cleanup queries
```

---

**Happy Testing! 🧪**
