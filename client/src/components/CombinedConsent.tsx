import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, Cookie, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { logConsent } from "@/lib/api";
import { sessionFetch, getGlobalSessionId } from "../lib/sessionManager";
import { useLegalDisclaimer } from "../hooks/useLegalDisclaimer";
import { useCookieConsent } from "../hooks/useCookieConsent";
import { safeDispatchEvent } from "../lib/safeDispatchEvent";

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

// Track if we've already initialized consent to prevent double-mounts in StrictMode
let hasInitializedConsent = false;
let initializationInProgress = false;

// Combined hook for managing both legal and cookie consent
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

// Modal popup version for unobtrusive consent
export function CombinedConsent({ onAccept }: CombinedConsentProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLogging, setIsLogging] = useState(false);
  const initRef = useRef(false);

  // Use the individual consent hooks to ensure proper state synchronization
  const { acceptDisclaimer } = useLegalDisclaimer();
  const { acceptAllCookies } = useCookieConsent();

  // Check if consent was already handled to prevent double-mount in StrictMode
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

  const handleAccept = async () => {
    if (isLogging) return; // Prevent multiple clicks
    setIsLogging(true);

    try {
      console.log('Accepting combined consent through individual hooks...');

      // Accept both legal disclaimer and cookies using their respective hooks
      // IMPORTANT: These NOW properly await the database saves
      await Promise.all([
        acceptDisclaimer(),
        acceptAllCookies()
      ]);

      // Mark as recently accepted to prevent banner flash
      recentlyAccepted = true;
      if (acceptanceTimer) clearTimeout(acceptanceTimer);
      acceptanceTimer = window.setTimeout(() => {
        recentlyAccepted = false;
      }, 2000);

      // Close modal and call onAccept
      setIsOpen(false);
      onAccept();

      console.log('Combined consent accepted successfully');

    } catch (error) {
      console.warn('Failed to accept combined consent:', error);
    } finally {
      setIsLogging(false);
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={undefined}>
      <DialogContent className="max-w-sm p-4 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700" hideCloseButton>
        <DialogHeader className="text-center mb-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <Cookie className="w-4 h-4 text-blue-600 dark:text-blue-300" />
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

          <div className="mt-2 text-[10px] text-center sm:text-left text-gray-500 dark:text-gray-400">
            <a href="/privacy" className="text-blue-600 dark:text-blue-300 hover:underline">Privacy Policy</a>
            <span className="mx-1">•</span>
            <a href="/terms" className="text-blue-600 dark:text-blue-300 hover:underline">Terms of Service</a>
            <span className="mx-1">•</span>
            <a href="/cookies" className="text-blue-600 dark:text-blue-300 hover:underline">Cookie Policy</a>
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
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 shadow-xl">
      <div className="max-w-6xl mx-auto px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Cookie className="w-4 h-4 text-blue-600 dark:text-blue-300 flex-shrink-0" />
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

          <div className="mt-2 text-[10px] text-center sm:text-left text-gray-500 dark:text-gray-400">
            <a href="/privacy" className="text-blue-600 dark:text-blue-300 hover:underline">Privacy Policy</a>
            <span className="mx-1">•</span>
            <a href="/terms" className="text-blue-600 dark:text-blue-300 hover:underline">Terms of Service</a>
            <span className="mx-1">•</span>
            <a href="/cookies" className="text-blue-600 dark:text-blue-300 hover:underline">Cookie Policy</a>
          </div>
        </div>
    </div>
  );
}