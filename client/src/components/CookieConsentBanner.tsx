import { useState } from "react";
import { Cookie, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logConsent } from "@/lib/api";

interface CookieConsentBannerProps {
  onAccept: () => void;
}

export function CookieConsentBanner({ onAccept }: CookieConsentBannerProps) {
  const [isLogging, setIsLogging] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

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
      setIsVisible(false);
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('consentChanged'));
      onAccept();
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-2 mt-1">
            <Cookie className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Cookie Consent & Terms
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              We use essential cookies for session management and security. By continuing, you agree that this service provides informational summaries only (not legal advice), and we&apos;re not liable for decisions made based on these summaries. You can browse and view samples without accepting, but document analysis requires consent.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleAccept}
              disabled={isLogging}
              size="sm"
              className="text-xs"
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
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
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