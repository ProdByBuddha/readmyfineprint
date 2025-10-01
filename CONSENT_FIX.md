# Consent System Fix

## Problem
After accepting consent, subsequent API calls (like clicking sample documents) were still saying "consent is required".

## Root Cause
The consent verification middleware was only checking `req.sessionId` but not falling back to the `x-session-id` header when `req.sessionId` was undefined. This could happen if:
1. The session middleware hadn't run yet (timing issue)
2. The client was sending the session ID only in headers

When logging consent, the system used `req.sessionId`, but when verifying consent later, it might not find the same session ID, causing consent to appear "missing".

## Solution
Added fallback to check the `x-session-id` header in two places:

### 1. Consent Middleware (server/auth.ts, line 721-726)
```typescript
// Get session ID from req.sessionId or fallback to header
let sessionId = (req as any).sessionId;
if (!sessionId) {
  sessionId = req.headers['x-session-id'] as string;
}
const consentProof = await consentLogger.verifyUserConsent(ip, userAgent, userId, sessionId);
```

### 2. Document Analysis Route (server/routes.ts, line 1537-1542)
```typescript
// Get session ID with fallback to header
let sessionId = req.sessionId;
if (!sessionId) {
  sessionId = req.headers['x-session-id'] as string;
}
const consentProof = await consentLogger.verifyUserConsent(ip, userAgent, userId, sessionId);
```

## Testing
After this fix:
1. User accepts consent → consent is logged with session ID
2. User clicks sample document → verification checks both `req.sessionId` AND header
3. Consent is found and user can proceed ✅

## Additional Improvements
- Added debug logging to track consent checks
- Consistent session ID extraction across all consent-related code
- Better error messages for debugging

## Files Modified
- `server/auth.ts` - Consent middleware
- `server/routes.ts` - Document analysis route
