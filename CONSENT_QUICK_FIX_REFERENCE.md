# Quick Reference: Consent Glitch Fix

## What Was Fixed

| Issue | Cause | Fix |
|-------|-------|-----|
| **Consent asked twice** | Modal + Banner both rendering, React StrictMode double-mount | Global state check + useRef guard |
| **Async not syncing** | Functions returned before DB save completed | Made functions await DB confirmation |
| **Race conditions** | Two independent async flows | Promise.all() ensures both complete |

---

## Key Changes

### File: `CombinedConsent.tsx`

**Line 61**: Added `useRef` to prevent double-mounts
```tsx
const initRef = useRef(false);
```

**Lines 68-82**: New initialization guard
```tsx
useEffect(() => {
  if (initRef.current) return;
  if (globalConsentState?.status) {
    setIsOpen(false);
    return;
  }
  initRef.current = true;
}, []);
```

**Lines 88-96**: NOW properly awaits both hooks
```tsx
await Promise.all([
  acceptDisclaimer(),      // ✅ NOW waits for DB save
  acceptAllCookies()       // ✅ NOW waits for DB save
]);
```

### File: `useLegalDisclaimer.ts`

**Line 224**: Now throws if DB save fails
```tsx
const saved = await saveToDatabase(true);
if (!saved) {
  throw new Error('Failed to save disclaimer to database');
}
```

### File: `useCookieConsent.ts`

**Lines 270-278**: Now throws if DB save fails
```tsx
const saved = await saveToDatabase(allAcceptedSettings);
if (!saved) {
  throw new Error('Failed to save cookie consent to database');
}
```

---

## Testing the Fix

### Manual Test
1. Open DevTools → Network tab
2. Visit site → Should see ONE consent modal
3. Click "Accept All & Continue"
4. Modal should show "Processing..." for ~500ms
5. Verify POST to `/api/consent` succeeds
6. Modal closes
7. Refresh page → NO consent modal
8. Check Console for: "✅ Legal disclaimer saved to database successfully"

### Browser Console
```javascript
// Should be true
localStorage.getItem('cookie-consent-accepted') === 'true'

// Should exist
JSON.parse(localStorage.getItem('cookie-consent-settings'))
// {necessary: true, analytics: true, marketing: true}
```

---

## What to Watch For

⚠️ **Modal takes longer to close** (500ms-1s)
- This is INTENTIONAL - it waits for backend
- Better UX than asking for consent twice

✅ **React DevTools shows one render** (not two)
✅ **Console has exactly one "Accepting combined consent..." log**
✅ **No 409/500 errors in Network tab**

---

## Rollback Plan

If issues arise:
```bash
git revert HEAD~3  # Reverts all three files
npm run dev
```

No database changes, so rollback is safe.

---

## Performance Trade-off

- **Before**: Modal closes instantly (but consent not actually saved)
- **After**: Modal waits 500-1000ms (consent guaranteed saved)

The 500ms delay is acceptable because:
- ✅ User only sees this once (not repeatedly)
- ✅ Consent is now actually persisted
- ✅ Better than asking twice

---

## Key Learning

**The core issue**: Promise returns don't mean operations complete.

```javascript
// ❌ OLD - Returns but operation still pending
async function save() {
  updateUI();
  asyncSave(); // fire-and-forget
  return;      // returns immediately
}

// ✅ NEW - Returns only when operation complete
async function save() {
  updateUI();
  await asyncSave(); // waits for completion
  return;            // returns only after confirm
}
```

This principle applies to all async operations where callers need confirmation.
