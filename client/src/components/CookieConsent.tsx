import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Cookie, X, CheckCircle } from 'lucide-react';

interface CookieConsentProps {
  onAccept?: () => void;
}

export function CookieConsent({ onAccept }: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const consentAccepted = localStorage.getItem('cookie-consent-accepted');
    if (consentAccepted === 'true') {
      setIsAccepted(true);
      return;
    }

    // Show banner immediately since it's required for functionality
    setIsVisible(true);
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent-accepted', 'true');
    setIsVisible(false);
    setIsAccepted(true);
    onAccept?.();

    // Reload the page to reset the UI and enable document processing
    window.location.reload();
  };

  const dismissBanner = () => {
    setIsVisible(false);
    // Don't set acceptance, banner will reappear on next visit
  };

  if (isAccepted || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-2xl mx-auto">
      <Card className="border-blue-200 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Cookie className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  🍪 Simple Cookie Notice
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  We use only <strong>essential cookies</strong> for basic functionality. No tracking,
                  no ads, no hassle. These cookies help remember your preferences and keep your session working.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Session management</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Theme preferences</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Legal consent</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={acceptCookies}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Accept Essential Cookies
                </Button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Learn more in our{' '}
                <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook for managing cookie consent state
export function useCookieConsent() {
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    const consentAccepted = localStorage.getItem('cookie-consent-accepted');
    setIsAccepted(consentAccepted === 'true');
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent-accepted', 'true');
    setIsAccepted(true);

    // Reload the page to reset the UI
    window.location.reload();
  };

  const revokeCookies = () => {
    localStorage.removeItem('cookie-consent-accepted');
    setIsAccepted(false);
  };

  return {
    isAccepted,
    acceptCookies,
    revokeCookies
  };
}
