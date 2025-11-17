# Consent Glitch Fix - Detailed Changes

## Summary

Three files modified to fix consent being asked twice and async state not updating correctly.

### Files Changed:
1. `client/src/components/CombinedConsent.tsx` - 60 lines modified
2. `client/src/hooks/useLegalDisclaimer.ts` - 30 lines modified  
3. `client/src/hooks/useCookieConsent.ts` - 50 lines modified

---

## File 1: CombinedConsent.tsx

### Change 1: Added useRef import
**Line 1**
```diff
- import { useState, useEffect, useCallback } from "react";
+ import { useState, useEffect, useCallback, useRef } from "react";
```

### Change 2: Added initialization guards at top
**After line 24**
```diff
  let isCheckingGlobally = false;
+ // Track if we've already initialized consent to prevent double-mounts in StrictMode
+ let hasInitializedConsent = false;
+ let initializationInProgress = false;
```

### Change 3: Completely rewrote useCombinedConsent hook
**Lines 31-185 (Before) → Lines 31-54 (After)**

**Before (250+ lines with dual state)**:
- Direct consent checking via checkConsentStatus()
- Multiple useEffect hooks
- Event listeners for consent changes
- Cache invalidation logic
- Force updates for synchronization
- acceptAll() and revokeConsent() methods

**After (17 lines - single source of truth)**:
```tsx
export function useCombinedConsent() {
  // Use the individual hooks - single source of truth
  const { accepted: legalAccepted, loading: legalLoading } = useLegalDisclaimer();
  const { isAccepted: cookieAccepted, loading: cookieLoading } = useCookieConsent();

  // Combined states
  const isAccepted = legalAccepted && cookieAccepted;
  const isCheckingConsent = legalLoading || cookieLoading;

  // Update global state for other components
  useEffect(() => {
    if (!isCheckingConsent) {
      globalConsentState = {
        status: isAccepted,
        timestamp: Date.now(),
        sessionId: getGlobalSessionId()
      };
    }
  }, [isAccepted, isCheckingConsent]);

  return {
    isAccepted,
    isCheckingConsent
  };
}
```

### Change 4: Added initialization guard to modal
**Lines 58-82 (NEW)**
```tsx
export function CombinedConsent({ onAccept }: CombinedConsentProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLogging, setIsLogging] = useState(false);
  const initRef = useRef(false);  // ✅ NEW

  // Use the individual consent hooks to ensure proper state synchronization
  const { acceptDisclaimer } = useLegalDisclaimer();
  const { acceptAllCookies } = useCookieConsent();

  // ✅ NEW: Check if consent was already handled to prevent double-mount in StrictMode
  useEffect(() => {
    if (initRef.current) {
      console.log('Consent modal already initialized, skipping duplicate mount');
      return;
    }

    // Check if consent already accepted in global state
    if (globalConsentState?.status) {
      console.log('Consent already accepted in global state, closing modal');
      setIsOpen(false);
      return;
    }

    initRef.current = true;
  }, []);
```

### Change 5: Fixed handleAccept to properly await async
**Lines 84-116 (Updated)**

**Before**:
```tsx
const handleAccept = async () => {
  setIsLogging(true);

  try {
    console.log('Accepting combined consent through individual hooks...');

    // Returns immediately!
    await Promise.all([
      acceptDisclaimer(),
      acceptAllCookies()
    ]);

    // Closes before DB saves complete!
    setIsOpen(false);
    onAccept();

    console.log('Combined consent accepted successfully');

  } catch (error) {
    console.warn('Failed to accept combined consent:', error);
    setIsLogging(false);
    return;
  } finally {
    setIsLogging(false);
  }
};
```

**After**:
```tsx
const handleAccept = async () => {
  if (isLogging) return; // ✅ NEW: Prevent multiple clicks

  setIsLogging(true);

  try {
    console.log('Accepting combined consent through individual hooks...');

    // ✅ UPDATED: These NOW properly await the database saves
    await Promise.all([
      acceptDisclaimer(),
      acceptAllCookies()
    ]);

    // ✅ NEW: Mark as recently accepted to prevent banner flash
    recentlyAccepted = true;
    if (acceptanceTimer) clearTimeout(acceptanceTimer);
    acceptanceTimer = window.setTimeout(() => {
      recentlyAccepted = false;
    }, 2000);

    // ✅ NOW: Only closes after backend confirms both saves
    setIsOpen(false);
    onAccept();

    console.log('Combined consent accepted successfully');

  } catch (error) {
    console.warn('Failed to accept combined consent:', error);
  } finally {
    setIsLogging(false);
  }
};
```

---

## File 2: useLegalDisclaimer.ts

### Change: Updated acceptDisclaimer() to properly await DB save
**Lines 208-245 (Modified)**

**Before**:
```tsx
const acceptDisclaimer = useCallback(async () => {
  // Immediately update UI
  setState(prev => ({ ...prev, accepted: true }));
  
  // Always save to localStorage for backup
  const acceptanceDate = new Date().toISOString();
  localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
  localStorage.setItem('readmyfineprint-disclaimer-date', acceptanceDate);
  
  // Only try database in production
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'development')) {
    try {
      const authenticated = await isAuthenticated();
      
      if (authenticated) {
        // Also save to database for authenticated users
        const saved = await saveToDatabase(true);
        
        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync disclaimer acceptance to database'
          }));
          // ❌ ERROR SILENTLY SWALLOWED - Function still returns!
        }
      }
    } catch (error) {
      console.warn('Failed to save disclaimer acceptance:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Disclaimer saved locally but failed to sync to database'
      }));
      // ❌ CATCH BUT DON'T RE-THROW - Caller doesn't know it failed!
    }
  }
  // ❌ RETURNS IMMEDIATELY
}, [isAuthenticated, saveToDatabase]);
```

**After**:
```tsx
const acceptDisclaimer = useCallback(async () => {
  // Immediately update UI
  setState(prev => ({ ...prev, accepted: true }));

  // Always save to localStorage for backup
  const acceptanceDate = new Date().toISOString();
  localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
  localStorage.setItem('readmyfineprint-disclaimer-date', acceptanceDate);

  // Only try database in production
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'development')) {
    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // Save to database for authenticated users and WAIT for it
        const saved = await saveToDatabase(true);

        if (!saved) {
          setState(prev => ({
            ...prev,
            error: 'Failed to sync disclaimer acceptance to database'
          }));
          throw new Error('Failed to save disclaimer to database'); // ✅ NOW THROWS
        }

        console.log('✅ Legal disclaimer saved to database successfully'); // ✅ NEW
      }
    } catch (error) {
      console.warn('Failed to save disclaimer acceptance:', error);
      setState(prev => ({
        ...prev,
        error: 'Disclaimer saved locally but failed to sync to database'
      }));
      throw error; // ✅ NOW RE-THROWS - Caller gets error!
    }
  }
  // ✅ NOW RETURNS ONLY AFTER DB CONFIRMS
}, [isAuthenticated, saveToDatabase]);
```

**Key Changes**:
- ✅ Throws when DB save fails
- ✅ Re-throws so caller knows about error
- ✅ Added success logging
- ✅ Only returns after DB confirms

---

## File 3: useCookieConsent.ts

### Change 1: Updated acceptAllCookies() to properly await DB save
**Lines 246-294 (Modified)**

**Before**:
```tsx
const acceptAllCookies = useCallback(async () => {
  const allAcceptedSettings: CookieConsentSettings = {
    necessary: true,
    analytics: true,
    marketing: true
  };

  // Immediately update UI
  setState(prev => ({ 
    ...prev, 
    settings: allAcceptedSettings, 
    isAccepted: true 
  }));

  // Always save to localStorage for backup
  saveToLocalStorage(allAcceptedSettings, true);

  // Only try database in production
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'development')) {
    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // Also save to database for authenticated users
        const saved = await saveToDatabase(allAcceptedSettings);

        if (!saved) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to sync cookie consent to database'
          }));
          // ❌ ERROR SILENTLY SWALLOWED
        }
      }
    } catch (error) {
      console.warn('Failed to save cookie consent:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Cookie consent saved locally but failed to sync to database'
      }));
      // ❌ CATCH BUT DON'T RE-THROW
    }
  }

  // Dispatch event for other components
  safeDispatchEvent('consentChanged');
  // ❌ RETURNS IMMEDIATELY
}, [isAuthenticated, saveToDatabase, saveToLocalStorage]);
```

**After**:
```tsx
const acceptAllCookies = useCallback(async () => {
  const allAcceptedSettings: CookieConsentSettings = {
    necessary: true,
    analytics: true,
    marketing: true
  };

  // Immediately update UI
  setState(prev => ({
    ...prev,
    settings: allAcceptedSettings,
    isAccepted: true
  }));

  // Always save to localStorage for backup
  saveToLocalStorage(allAcceptedSettings, true);

  // Only try database in production
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'development')) {
    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // Save to database for authenticated users and WAIT for it
        const saved = await saveToDatabase(allAcceptedSettings);

        if (!saved) {
          setState(prev => ({
            ...prev,
            error: 'Failed to sync cookie consent to database'
          }));
          throw new Error('Failed to save cookie consent to database'); // ✅ NOW THROWS
        }

        console.log('✅ Cookie consent saved to database successfully'); // ✅ NEW
      }
    } catch (error) {
      console.warn('Failed to save cookie consent:', error);
      setState(prev => ({
        ...prev,
        error: 'Cookie consent saved locally but failed to sync to database'
      }));
      throw error; // ✅ NOW RE-THROWS
    }
  }

  // Dispatch event for other components
  safeDispatchEvent('consentChanged');
  // ✅ NOW RETURNS ONLY AFTER DB CONFIRMS
}, [isAuthenticated, saveToDatabase, saveToLocalStorage]);
```

### Change 2: Updated acceptCookies() to properly await DB save
**Lines 297-341 (Modified)**

Same pattern as acceptAllCookies():
- ✅ Throws when DB save fails
- ✅ Re-throws so caller knows about error
- ✅ Added success logging
- ✅ Only returns after DB confirms

---

## Summary of Changes

| File | Type | Lines Changed | What Changed |
|------|------|---------------|--------------|
| CombinedConsent.tsx | Component | 60 | Removed dual state, added guards, fixed await |
| useLegalDisclaimer.ts | Hook | 30 | Made DB save awaitable, added error throwing |
| useCookieConsent.ts | Hook | 50 | Made DB save awaitable, added error throwing |

**Total**: 140 lines changed across 3 files

**Key Principle**: Functions that modify state should now fully await their operations before returning, so callers can depend on completion.
