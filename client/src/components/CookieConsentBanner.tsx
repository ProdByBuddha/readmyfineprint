import { useState, useEffect } from "react";
import { Cookie, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sessionFetch, getGlobalSessionId } from "@/lib/sessionManager";
import { safeDispatchEvent } from "@/lib/safeDispatchEvent";

interface CookieConsentBannerProps {
  onAccept: () => void;
}

const BANNER_DISMISSED_KEY = 'consent-banner-dismissed';

export function CookieConsentBanner({ onAccept }: CookieConsentBannerProps) {
  const [isLogging, setIsLogging] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Check if banner was already dismissed in this session
  useEffect(() => {
    try {
      const wasDismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
      if (wasDismissed === 'true') {
        setIsVisible(false);
      }
    } catch (error) {
      console.warn('Failed to check banner dismissal state:', error);
    }
  }, []);

  const handleAccept = async () => {
    setIsLogging(true);

    try {
      const sessionId = getGlobalSessionId();
      console.log(`Logging consent from banner with session: ${sessionId.substring(0, 16)}...`);

      // Log consent to database using session fetch
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
        console.warn('Consent logging warning:', result.message);
        // Don't proceed if consent logging failed
        setIsLogging(false);
        return;
      }

      console.log('✅ Consent logged successfully from banner');

      // Store acceptance locally for backup
      const acceptanceDate = new Date().toISOString();
      localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
      localStorage.setItem('readmyfineprint-disclaimer-date', acceptanceDate);
      localStorage.setItem('cookie-consent-accepted', 'true');

      // Clear dismissal flag since they've now accepted
      sessionStorage.removeItem(BANNER_DISMISSED_KEY);

      // Store consent verification data if provided
      if (result.consentId && result.verificationToken) {
        sessionStorage.setItem('readmyfineprint-consent-id', result.consentId);
        sessionStorage.setItem('readmyfineprint-verification-token', result.verificationToken);
      }

    } catch (error) {
      console.warn('Consent logging failed:', error);
      // Don't proceed if consent logging failed
      setIsLogging(false);
      return;
    } finally {
      setIsLogging(false);
      setIsVisible(false);
      
      // Dispatch custom event to notify other components that consent has changed
      // This will trigger the useCombinedConsent hook to re-check consent status
      safeDispatchEvent('consentChanged');
      
      // Small delay to ensure state propagates before calling onAccept
      setTimeout(() => {
        onAccept();
      }, 100);
    }
  };

  const handleDismiss = () => {
    // Remember dismissal for this session
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    } catch (error) {
      console.warn('Failed to save banner dismissal state:', error);
    }
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex items-center gap-2 sm:mt-1">
            <Cookie className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0" />
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          </div>
          
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Cookie Consent & Terms
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              We use essential cookies for session management and security. By continuing, you agree that this service provides informational summaries only (not legal advice), and we&apos;re not liable for decisions made based on these summaries. You can browse and view samples without accepting, but document analysis requires consent.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleAccept}
              disabled={isLogging}
              size="sm"
              className="text-xs flex-1 sm:flex-initial"
            >
              {isLogging ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                "Accept & Continue"
              )}
            </Button>
            
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mt-3 text-[10px]">
          <a href="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Privacy Policy
          </a>
          <a href="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
}