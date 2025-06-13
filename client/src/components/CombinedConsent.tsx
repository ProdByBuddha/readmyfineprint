import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Cookie, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logConsent } from "@/lib/api";

interface CombinedConsentProps {
  onAccept: () => void;
}

// Combined hook for managing both legal and cookie consent
export function useCombinedConsent() {
  const [isAccepted, setIsAccepted] = useState(false);

  const checkConsent = useCallback(() => {
    const legalAccepted = localStorage.getItem('readmyfineprint-disclaimer-accepted');
    const cookiesAccepted = localStorage.getItem('cookie-consent-accepted');
    setIsAccepted(legalAccepted === 'true' && cookiesAccepted === 'true');
  }, []);

  useEffect(() => {
    checkConsent();
    
    // Listen for storage changes from other components
    window.addEventListener('storage', checkConsent);
    
    // Listen for custom consent events
    window.addEventListener('consentChanged', checkConsent);
    
    return () => {
      window.removeEventListener('storage', checkConsent);
      window.removeEventListener('consentChanged', checkConsent);
    };
  }, [checkConsent]);

  const acceptAll = () => {
    localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
    localStorage.setItem('readmyfineprint-disclaimer-date', new Date().toISOString());
    localStorage.setItem('cookie-consent-accepted', 'true');
    setIsAccepted(true);
  };

  const revokeConsent = () => {
    localStorage.removeItem('readmyfineprint-disclaimer-accepted');
    localStorage.removeItem('readmyfineprint-disclaimer-date');
    localStorage.removeItem('cookie-consent-accepted');
    setIsAccepted(false);
  };

  return {
    isAccepted,
    acceptAll,
    revokeConsent,
  };
}

// Modal popup version for unobtrusive consent
export function CombinedConsent({ onAccept }: CombinedConsentProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLogging, setIsLogging] = useState(false);

  const handleAccept = async () => {
    setIsLogging(true);

    try {
      // Log consent to server (anonymous, PII-protected)
      const result = await logConsent();

      // Store acceptance locally regardless of server logging result
      const acceptanceDate = new Date().toISOString();
      localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
      localStorage.setItem('readmyfineprint-disclaimer-date', acceptanceDate);
      localStorage.setItem('cookie-consent-accepted', 'true');

      // Store consent verification data if provided
      if (result.consentId && result.verificationToken) {
        sessionStorage.setItem('readmyfineprint-consent-id', result.consentId);
        sessionStorage.setItem('readmyfineprint-verification-token', result.verificationToken);
      }

      if (!result.success) {
        console.warn('Consent logging warning:', result.message);
      }

    } catch (error) {
      console.warn('Consent logging failed, but continuing:', error);
      // Still store locally and continue - don't block user
      localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
      localStorage.setItem('readmyfineprint-disclaimer-date', new Date().toISOString());
      localStorage.setItem('cookie-consent-accepted', 'true');
    } finally {
      setIsLogging(false);
      setIsOpen(false);
      onAccept();
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
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Quick consent setup to get started
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {/* Unified consent summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <h4 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">By continuing, you agree to:</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Service provides informational summaries, not legal advice</li>
              <li>• Educational tool only - we're not liable for decisions made</li>
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
  const { isAccepted, acceptAll } = useCombinedConsent();

  // Don't show banner if already accepted
  if (isAccepted) {
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