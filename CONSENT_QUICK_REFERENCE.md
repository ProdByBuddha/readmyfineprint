# Consent System - Quick Reference Guide

## Project Overview
- **Type**: Full-stack TypeScript/React Application (v2.0.0)
- **Backend**: Express.js with PostgreSQL + Drizzle ORM
- **Frontend**: React with Vite
- **Consent Storage**: PostgreSQL (production) + localStorage (backup)

---

## File Quick Links

### Backend Consent Files
```
server/consent.ts              → Core consent logic (480 lines)
server/routes.ts               → API endpoints (lines 1201-1315)
shared/schema.ts               → Database schema (lines 127-136)
```

### Frontend Consent Files
```
client/src/components/CombinedConsent.tsx       → Main consent coordination (557 lines)
client/src/components/CookieConsentBanner.tsx   → Bottom banner UI (166 lines)
client/src/components/CookieConsent.tsx         → Legacy component (123 lines)
client/src/hooks/useCookieConsent.ts            → Cookie settings (428 lines)
client/src/hooks/useLegalDisclaimer.ts          → Disclaimer hook (336 lines)
```

---

## Database Table: consent_records

```
id (uuid)                      → Primary key
consentId (text)               → Unique consent identifier
userPseudonym (text)           → Hashed user identifier
ipHash (text)                  → Hashed IP address
userAgentHash (text)           → Hashed User-Agent
termsVersion (text)            → Terms version number
verificationToken (text)       → For user self-verification
createdAt (timestamp)          → When consent was given
```

---

## API Endpoints (All under /api/consent)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/consent` | optional | Log user consent |
| POST/GET | `/api/consent/verify` | optional | Check if user has valid consent |
| POST | `/api/consent/verify-token` | none | User self-verify with token |
| POST | `/api/consent/revoke` | optional | Remove user consent |
| GET | `/api/consent/stats` | admin | Get consent metrics |

---

## React Component Integration Points

### 1. Main Dialog (First-Time Users)
```tsx
<CombinedConsent onAccept={() => {}} />
```
- Modal dialog
- Non-dismissible
- Shows both disclaimer + cookies

### 2. Bottom Banner (Fallback)
```tsx
<CookieConsentBanner onAccept={() => {}} />
```
- Fixed bottom position
- Session-dismissible
- Semi-transparent background

### 3. Using Hooks in Components
```tsx
const { accepted, acceptDisclaimer, revokeDisclaimer } = useLegalDisclaimer();
const { isAccepted, acceptAllCookies, revokeCookies } = useCookieConsent();
const { isAccepted, acceptAll, revokeConsent } = useCombinedConsent();
```

---

## Storage Locations

### LocalStorage Keys
```javascript
localStorage.getItem('cookie-consent-accepted')            // "true"|"false"
localStorage.getItem('cookie-consent-settings')             // JSON string
localStorage.getItem('readmyfineprint-disclaimer-accepted')  // "true"|"false"
localStorage.getItem('readmyfineprint-disclaimer-date')     // ISO timestamp
```

### SessionStorage Keys
```javascript
sessionStorage.getItem('consent-banner-dismissed')          // Session-only dismissal
sessionStorage.getItem('readmyfineprint-consent-id')        // Consent ID
sessionStorage.getItem('readmyfineprint-verification-token') // Verification token
```

---

## Event System

### Global Events (window)
```javascript
// Listen for consent changes
window.addEventListener('consentChanged', () => {})

// Listen for consent revocation
window.addEventListener('consentRevoked', () => {})

// Listen for auth changes (triggers consent re-check)
window.addEventListener('authStateChanged', () => {})
window.addEventListener('authUpdate', () => {})
```

### Event Dispatching
```javascript
// In safeDispatchEvent.ts
safeDispatchEvent('consentChanged')
safeDispatchEvent('consentRevoked')
```

---

## User Pseudonym Generation Logic

```
Authenticated User (has userId)
  → HMAC-SHA256('user:' + userId, masterKey)
  → First 24 characters

Free User (has sessionId)
  → HMAC-SHA256('session:' + sessionId, masterKey)
  → First 24 characters

Fallback (device fingerprint)
  → HMAC-SHA256('device:' + ip + ':' + userAgent, masterKey)
  → First 24 characters

Benefits:
✓ Same user = Same pseudonym (reproducible)
✓ No raw IP/User-Agent stored
✓ Can't be reversed without master key
✓ Different users = Different pseudonyms
```

---

## Environment Configuration

### Required Variables
```bash
DATABASE_URL=postgresql://user:pass@host/dbname
CONSENT_MASTER_KEY=your-secret-key (optional, has default)
NODE_ENV=development|production
```

### Mode-Based Behavior

**Development Mode** (`NODE_ENV=development`)
- Auto-accepts all consent
- Uses localStorage only
- No database calls
- Synchronous initialization

**Production Mode** (`NODE_ENV=production`)
- Requires database
- Dual storage: localStorage + database
- Async verification
- 30-second cache TTL

---

## Consent Flow Summary

### First-Time User
1. Page loads → Check localStorage
2. Empty → Show banner/modal
3. User clicks "Accept"
4. POST /api/consent → Get consentId + verificationToken
5. Store in localStorage + database
6. Dispatch 'consentChanged' event
7. Banner disappears

### Returning User
1. Page loads → Check localStorage
2. Found → Skip banner
3. No event dispatching needed

### Authenticated User (After Login)
1. Auth state changes
2. useLegalDisclaimer hook triggers
3. GET /api/user/preferences/legal-disclaimer
4. Check database OR use localStorage
5. Sync if needed (localStorage → database)

---

## Key Security Features

1. **Pseudonymization**
   - HMAC-SHA256 hashing with master key
   - Reproducible for same user
   - Cannot be reversed without key

2. **Data Hashing**
   - IP addresses: SHA-256 + salt
   - User-Agent: SHA-256 + salt
   - Verification tokens: HMAC-SHA256

3. **Deduplication**
   - 1-hour window prevents duplicate entries
   - Returns existing consent if found
   - Cache cleared on new consent

4. **Caching**
   - 30-second TTL on verification
   - Only positive results cached
   - Cleared on revocation

---

## Common Operations

### Accept Consent Programmatically
```typescript
// Option 1: Combined consent
const { acceptAll } = useCombinedConsent();
await acceptAll();

// Option 2: Separate consents
const { acceptDisclaimer } = useLegalDisclaimer();
const { acceptAllCookies } = useCookieConsent();
await Promise.all([acceptDisclaimer(), acceptAllCookies()]);
```

### Revoke Consent
```typescript
const { revokeConsent } = useCombinedConsent();
await revokeConsent();
```

### Check Consent Status
```typescript
const { isAccepted } = useCombinedConsent();
if (isAccepted) {
  // User has consented
}
```

### Verify User Consent (Server)
```typescript
import { consentLogger } from './consent';
const proof = await consentLogger.verifyUserConsent(ip, userAgent, userId, sessionId);
if (proof) {
  // User has valid consent
}
```

---

## Testing

Run consent tests:
```bash
node /opt/readmyfineprint/test-consent-system.js
node /opt/readmyfineprint/test-consent-frontend.js
```

---

## Dark Mode Support

All consent components support dark mode:
```css
/* Light mode (default) */
background-color: white
text-color: gray-900
border-color: gray-200

/* Dark mode (with dark: prefix) */
background-color: gray-800/900
text-color: gray-100
border-color: gray-700
```

---

## Performance Notes

- **Cache TTL**: 30 seconds
- **Dedup Window**: 1 hour
- **Cleanup Cycle**: 5 minutes
- **Concurrent Checks**: Prevented (mutex-like global flag)
- **Typical Response Time**: <100ms (cached), <500ms (database)

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Consent not persisting | DATABASE_URL not set | Set DATABASE_URL env var |
| Banner keeps showing | localStorage cleared | Check browser storage |
| Can't revoke consent | Database error | Check database connection |
| Pseudonym inconsistent | Different session ID | Use userId for logged-in users |
| Cache not clearing | Server restart needed | Restart process |

---

## References

- Full analysis: `CODEBASE_CONSENT_ANALYSIS.md`
- Consent fix notes: `CONSENT_FIX.md`
- Schema details: `shared/schema.ts`
- Route handlers: `server/routes.ts` (lines 1201-1315)

