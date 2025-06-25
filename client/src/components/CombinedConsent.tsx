import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Cookie, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { logConsent } from "@/lib/api";

interface CombinedConsentProps {
  onAccept: () => void;
}

// Cache consent status to prevent excessive API calls
let consentCache: { status: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 30000; // 30 seconds cache

// Track recent consent acceptance to prevent banner flash
let recentlyAccepted = false;
let acceptanceTimer: NodeJS.Timeout | null = null;

// Combined hook for managing both legal and cookie consent
export function useCombinedConsent() {
  const [isAccepted, setIsAccepted] = useState(false);
  const [isCheckingConsent, setIsCheckingConsent] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);

  const checkConsent = useCallback(async () => {
    // Check cache first to prevent excessive API calls
    const now = Date.now();
    if (consentCache && (now - consentCache.timestamp) < CACHE_DURATION) {
      setIsAccepted(consentCache.status);
      setIsCheckingConsent(false);
      return;
    }
    
    // Set checking state
    setIsCheckingConsent(true);
    
    try {
      const response = await fetch('/api/consent/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        const hasConsented = result.hasConsented;
        
        // Update cache
        consentCache = { status: hasConsented, timestamp: now };
        setIsAccepted(hasConsented);
      } else {
        // Cache negative result briefly to prevent spam
        consentCache = { status: false, timestamp: now };
        setIsAccepted(false);
      }
    } catch (error) {
      console.warn('Failed to verify consent with database:', error);
      // Don't cache errors, but assume no consent to be safe
      setIsAccepted(false);
    } finally {
      setIsCheckingConsent(false);
    }
  }, []);

  useEffect(() => {
    // Only check consent on initial mount
    const initialCheck = async () => {
      await checkConsent();
    };
    initialCheck();

    // Create event handlers with debouncing
    let debounceTimer: NodeJS.Timeout;
    
    const handleConsentChange = () => {
      // Clear cache when consent changes
      consentCache = null;
      
      // Debounce multiple consent change events
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkConsent();
      }, 100); // Reduced delay for faster updates
    };

    const handleConsentRevoked = () => {
      // Clear cache and update state immediately
      consentCache = null; // Clear cache entirely when revoked
      setIsAccepted(false);
      setIsCheckingConsent(false);
      console.log('Consent revoked - enabling gray mode');
      
      // Force immediate re-check to ensure all components are synchronized
      setTimeout(() => {
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
    
    try {
      // Log consent to database only
      const result = await logConsent();

      if (!result.success) {
        console.warn('Consent logging warning:', result.message);
        setIsAccepted(false);
        setIsCheckingConsent(false);
        return;
      }

      // Update cache and state immediately
      consentCache = { status: true, timestamp: Date.now() };
      setIsAccepted(true);
      setIsCheckingConsent(false);

      // Mark as recently accepted to prevent banner flash
      recentlyAccepted = true;
      if (acceptanceTimer) clearTimeout(acceptanceTimer);
      acceptanceTimer = setTimeout(() => {
        recentlyAccepted = false;
      }, 1000); // Prevent banner for 1 second after acceptance

      // Force update for components using this hook
      setForceUpdate(prev => prev + 1);

      // Dispatch custom event to notify other components immediately
      window.dispatchEvent(new CustomEvent('consentChanged'));

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
    
    try {
      const response = await fetch('/api/consent/revoke', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      if (!result.success) {
        console.warn('Failed to revoke consent in database:', result.message);
      }

      // Clear cache and update state immediately
      consentCache = null; // Clear cache entirely when revoked
      setIsAccepted(false);
      setIsCheckingConsent(false);

      // Clear recent acceptance flag when revoking
      recentlyAccepted = false;
      if (acceptanceTimer) clearTimeout(acceptanceTimer);

      // Force update for components using this hook
      setForceUpdate(prev => prev + 1);

      // Dispatch custom event to notify other components immediately
      window.dispatchEvent(new CustomEvent('consentRevoked'));
      window.dispatchEvent(new CustomEvent('consentChanged'));

    } catch (error) {
      console.warn('Failed to revoke consent from database:', error);
      // Still clear cache and update state even if revocation failed
      consentCache = null; // Clear cache entirely when revoked
      setIsAccepted(false);
      setIsCheckingConsent(false);

      // Clear recent acceptance flag when revoking
      recentlyAccepted = false;
      if (acceptanceTimer) clearTimeout(acceptanceTimer);

      window.dispatchEvent(new CustomEvent('consentRevoked'));
      window.dispatchEvent(new CustomEvent('consentChanged'));
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
      // Log consent to database only
      const result = await logConsent();

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

  // Don't show banner if already accepted, still checking, or recently accepted
  if (isAccepted || isCheckingConsent || recentlyAccepted) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
                We use essential cookies for functionality
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                No tracking, no ads, just the basics to make the app work.
                <a href="/cookies" className="text-primary hover:underline ml-1">
                  Learn more
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={acceptAll}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
