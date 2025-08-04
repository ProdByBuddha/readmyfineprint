import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Cookie, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { logConsent } from "@/lib/api";
import { sessionFetch, getGlobalSessionId } from "../lib/sessionManager";
import { useLegalDisclaimer } from "../hooks/useLegalDisclaimer";
import { useCookieConsent } from "../hooks/useCookieConsent";

interface CombinedConsentProps {
  onAccept: () => void;
}

// Global consent state to ensure all components are synchronized
let globalConsentState: { status: boolean; timestamp: number; sessionId?: string } | null = null;
const CACHE_DURATION = 30000; // 30 seconds cache

// Track recent consent acceptance to prevent banner flash
let recentlyAccepted = false;
let acceptanceTimer: number | null = null;

// Prevent concurrent consent checks
let isCheckingGlobally = false;

// Combined hook for managing both legal and cookie consent
export function useCombinedConsent() {
  const [isAccepted, setIsAccepted] = useState(false);
  const [isCheckingConsent, setIsCheckingConsent] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Use the new database-backed hooks
  const { accepted: legalAccepted, loading: legalLoading } = useLegalDisclaimer();
  const { isAccepted: cookieAccepted, loading: cookieLoading } = useCookieConsent();

  // Update combined consent state based on individual consents
  useEffect(() => {
    if (legalLoading || cookieLoading) {
      setIsCheckingConsent(true);
      return;
    }

    const combinedAccepted = legalAccepted && cookieAccepted;
    setIsAccepted(combinedAccepted);
    setIsCheckingConsent(false);

    // Update global state
    globalConsentState = { 
      status: combinedAccepted, 
      timestamp: Date.now(),
      sessionId: getGlobalSessionId()
    };
  }, [legalAccepted, cookieAccepted, legalLoading, cookieLoading]);

  const checkConsent = useCallback(async () => {
    // Check if we're in development mode and bypass consent checking
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      console.log('⚠️ Development mode: Bypassing consent verification');
      setIsAccepted(true);
      setIsCheckingConsent(false);
      globalConsentState = { status: true, timestamp: Date.now() };
      return;
    }

    // Check global cache first to prevent excessive API calls
    const now = Date.now();
    if (globalConsentState && (now - globalConsentState.timestamp) < CACHE_DURATION) {
      setIsAccepted(globalConsentState.status);
      setIsCheckingConsent(false);
      return;
    }

    // Prevent concurrent checks
    if (isCheckingGlobally) {
      if (import.meta.env.DEV) {
        console.log('Consent check already in progress, skipping...');
      }
      return;
    }

    // Set checking state
    isCheckingGlobally = true;
    setIsCheckingConsent(true);

    try {
      const sessionId = getGlobalSessionId();
      if (import.meta.env.DEV) {
        console.log(`Checking consent with session: ${sessionId.substring(0, 16)}...`);
      }

      const response = await sessionFetch('/api/consent/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const hasConsented = result.hasConsented === true;

        if (import.meta.env.DEV) {
          console.log('Consent check result:', { 
            hasConsented, 
            proof: !!result.proof, 
            sessionId: getGlobalSessionId().substring(0, 16),
            sessionResult: result 
          });
        }

        // Update global state and local state
        globalConsentState = { status: hasConsented, timestamp: now, sessionId: getGlobalSessionId() };
        setIsAccepted(hasConsented);

        // Force update to ensure all components sync
        setForceUpdate(prev => prev + 1);
      } else {
        console.warn('Consent check failed with status:', response.status);
        // Cache negative result briefly to prevent spam
        globalConsentState = { status: false, timestamp: now };
        setIsAccepted(false);
      }
    } catch (error) {
      console.warn('Failed to verify consent with database:', error);
      // Clear global cache and assume no consent to be safe
      globalConsentState = null;
      setIsAccepted(false);
    } finally {
      isCheckingGlobally = false;
      setIsCheckingConsent(false);
    }
  }, []);

  useEffect(() => {
    // Check consent on initial mount only if we don't have a recent cache
    const initialCheck = async () => {
      const sessionId = getGlobalSessionId();

      // If we have a recent cache entry for this session, use it
      if (globalConsentState && 
          globalConsentState.sessionId === sessionId && 
          (Date.now() - globalConsentState.timestamp) < CACHE_DURATION) {
        if (import.meta.env.DEV) {
          console.log(`Using cached consent state for session: ${sessionId.substring(0, 16)}...`);
        }
        setIsAccepted(globalConsentState.status);
        setIsCheckingConsent(false);
        return;
      }

      if (import.meta.env.DEV) {
        console.log(`Initial consent check - session: ${sessionId.substring(0, 16)}...`);
      }
      await checkConsent();
    };
    initialCheck();

    // Create event handlers with debouncing
    let debounceTimer: number;

    const handleConsentChange = () => {
      // Clear global cache when consent changes
      globalConsentState = null;

      // Debounce multiple consent change events
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        console.log('Handling consent change - rechecking consent');
        checkConsent();
      }, 100); // Reduced delay for faster updates
    };

    const handleConsentRevoked = () => {
      // Clear global cache and update state immediately
      globalConsentState = null; // Clear cache entirely when revoked
      setIsAccepted(false);
      setIsCheckingConsent(false);
      console.log('Consent revoked - enabling gray mode');

      // Force immediate re-check to ensure all components are synchronized
      setTimeout(() => {
        console.log('Re-checking consent after revocation');
        checkConsent();
        // Force re-render of all components using this hook
        setForceUpdate(prev => prev + 1);
      }, 100);
    };

    // Listen for custom consent events only
    window.addEventListener('consentChanged', handleConsentChange);
    window.addEventListener('consentRevoked', handleConsentRevoked);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('consentChanged', handleConsentChange);
      window.removeEventListener('consentRevoked', handleConsentRevoked);
    };
  }, []);

  const acceptAll = async () => {
    if (isCheckingConsent) return; // Prevent multiple simultaneous accepts

    // Set loading state
    setIsCheckingConsent(true);

    // Check if we're in development mode and bypass consent logging
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      console.log('⚠️ Development mode: Bypassing consent logging');
      globalConsentState = { status: true, timestamp: Date.now(), sessionId: getGlobalSessionId() };
      window.dispatchEvent(new CustomEvent('consentChanged'));
      setIsAccepted(true);
      setIsCheckingConsent(false);
      setForceUpdate(prev => prev + 1);
      recentlyAccepted = true;

      if (acceptanceTimer) clearTimeout(acceptanceTimer);
      acceptanceTimer = window.setTimeout(() => {
        recentlyAccepted = false;
      }, 2000);
      return;
    }

    try {
      // Log consent to database only - using the global API function that now uses sessionFetch
      const result = await logConsent();

      if (!result.success) {
        console.warn('Consent logging warning:', result.message);
        setIsAccepted(false);
        setIsCheckingConsent(false);
        return;
      }

      // Immediately notify other components of the change
      globalConsentState = { status: true, timestamp: Date.now(), sessionId: getGlobalSessionId() };
      window.dispatchEvent(new CustomEvent('consentChanged'));
      setIsAccepted(true);
      setIsCheckingConsent(false);

      // Force re-render of all components using this hook
      setForceUpdate(prev => prev + 1);

      console.log('Consent accepted successfully');
      recentlyAccepted = true;

      // Clear the recent acceptance flag after some time
      if (acceptanceTimer) clearTimeout(acceptanceTimer);
      acceptanceTimer = window.setTimeout(() => {
        recentlyAccepted = false;
      }, 2000);

    } catch (error) {
      console.warn('Consent logging failed:', error);
      setIsAccepted(false);
      setIsCheckingConsent(false);
      return;
    }
  };

  const revokeConsent = async () => {
    if (isCheckingConsent) return; // Prevent multiple simultaneous revocations

    // Set loading state
    setIsCheckingConsent(true);

    // Check if we're in development mode and bypass consent revocation
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      console.log('⚠️ Development mode: Bypassing consent revocation');
      globalConsentState = null;
      setIsAccepted(false);
      setIsCheckingConsent(false);
      window.dispatchEvent(new CustomEvent('consentRevoked'));
      setForceUpdate(prev => prev + 1);
      return;
    }

    try {
      const sessionId = getGlobalSessionId();
      console.log(`Revoking consent with session: ${sessionId.substring(0, 16)}...`);

      const response = await sessionFetch('/api/consent/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip: 'client-side-revoke',
          userAgent: navigator.userAgent,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        console.warn('Failed to revoke consent in database:', result.message);
      }

      // Clear global cache and update state immediately
      globalConsentState = null; // Clear cache entirely when revoked
      setIsAccepted(false);
      setIsCheckingConsent(false);

      // Clear recent acceptance flag when revoking
      recentlyAccepted = false;
      if (acceptanceTimer) clearTimeout(acceptanceTimer);

      // Force update for components using this hook immediately
      setForceUpdate(prev => prev + 1);

      // Single event dispatch for revocation
      window.dispatchEvent(new CustomEvent('consentRevoked'));

    } catch (error) {
      console.warn('Failed to revoke consent from database:', error);
      // Still clear global cache and update state even if revocation failed
      globalConsentState = null; // Clear cache entirely when revoked
      setIsAccepted(false);
      setIsCheckingConsent(false);

      // Clear recent acceptance flag when revoking
      recentlyAccepted = false;
      if (acceptanceTimer) clearTimeout(acceptanceTimer);

      window.dispatchEvent(new CustomEvent('consentRevoked'));
    }
  };

  return {
    isAccepted,
    isCheckingConsent,
    acceptAll,
    revokeConsent,
    forceUpdate
  };
}

// Modal popup version for unobtrusive consent
export function CombinedConsent({ onAccept }: CombinedConsentProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLogging, setIsLogging] = useState(false);

  const handleAccept = async () => {
    // Set logging state but keep modal open
    setIsLogging(true);

    try {
      const sessionId = getGlobalSessionId();
      console.log(`Logging consent with session: ${sessionId.substring(0, 16)}...`);

      // Log consent to database using session fetch with client session ID
      const response = await sessionFetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip: 'client-side-consent',
          userAgent: navigator.userAgent,
          termsVersion: '1.0',
        }),
      });

      const result = await response.json();
      if (!result.success) {
        console.warn('Consent logging failed:', result.message);
        setIsLogging(false);
        return;
      }

      // Close modal and call onAccept
      setIsOpen(false);
      onAccept();

    } catch (error) {
      console.warn('Consent logging failed:', error);
      setIsLogging(false);
      return;
    } finally {
      setIsLogging(false);
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm p-4 rounded-xl bg-white dark:bg-gray-900 border dark:border-gray-700" hideCloseButton>
        <DialogHeader className="text-center mb-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <Cookie className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">Privacy & Terms</DialogTitle>
          <DialogDescription className="text-xs text-gray-600 dark:text-gray-400">
            Quick consent setup to get started
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Unified consent summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <h4 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">By continuing, you agree to:</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Service provides informational summaries, not legal advice</li>
              <li>• Educational tool only - we&apos;re not liable for decisions made</li>
              <li>• Essential cookies for session management</li>
              <li>• Privacy promise: temporary processing, encrypted data, no sharing</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3">
          <Button
            onClick={handleAccept}
            disabled={isLogging}
            className="w-full text-sm"
            size="sm"
          >
            {isLogging ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              "Accept All & Continue"
            )}
          </Button>

          <div className="flex gap-2 text-[10px]">
            <a href="/terms" className="flex-1 text-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Terms
            </a>
            <a href="/privacy" className="flex-1 text-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Privacy
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple cookie banner for non-blocking consent
export function CookieConsent() {
  const { isAccepted, acceptAll, isCheckingConsent } = useCombinedConsent();
  const [isAccepting, setIsAccepting] = useState(false);

  // Don't show banner if already accepted, still checking, or recently accepted
  if (isAccepted || isCheckingConsent || recentlyAccepted) {
    return null;
  }

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptAll();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDismiss = () => {
    // Simple dismiss - just hide the banner
    recentlyAccepted = true;
    if (acceptanceTimer) clearTimeout(acceptanceTimer);
    acceptanceTimer = window.setTimeout(() => {
      recentlyAccepted = false;
    }, 30000); // Hide for 30 seconds
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 shadow-xl mb-0">
      <div className="max-w-6xl mx-auto px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Cookie className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-tight">
              Essential cookies only. By continuing, you agree this provides informational summaries (not legal advice).
              <span className="hidden sm:inline"> We're not liable for decisions based on summaries.</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleAccept}
              disabled={isAccepting}
              size="sm"
              className="text-xs px-3 py-1 h-7"
            >
              {isAccepting ? "..." : "Accept"}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="text-xs px-2 py-1 h-7"
            >
              ×
            </Button>
          </div>
        </div>
        <div className="flex gap-3 mt-1 text-[10px] justify-center sm:justify-start">
          <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy</a>
          <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</a>
          <a href="/cookies" className="text-blue-600 dark:text-blue-400 hover:underline">Cookie Details</a>
        </div>
      </div>
    </div>
  );
}