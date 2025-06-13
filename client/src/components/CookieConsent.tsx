import { useState, useEffect } from 'react';

// Hook for managing cookie consent status
export function useCookieConsent() {
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    const consentAccepted = localStorage.getItem('cookie-consent-accepted');
    setIsAccepted(consentAccepted === 'true');
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent-accepted', 'true');
    setIsAccepted(true);
  };

  const revokeCookies = () => {
    localStorage.removeItem('cookie-consent-accepted');
    setIsAccepted(false);
    window.location.reload();
  };

  return {
    isAccepted,
    acceptCookies,
    revokeCookies,
  };
}

// Cookie consent page component
export function CookieConsentPage({ onAccept }: { onAccept: () => void }) {
  const { acceptCookies } = useCookieConsent();

  const handleAccept = () => {
    acceptCookies();
    // Small delay to ensure state is updated before callback
    setTimeout(() => {
      onAccept();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Cookie & Privacy Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            We respect your privacy and want to be transparent about our data practices.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Essential Cookies (Always Active)
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              These cookies are necessary for the website to function and cannot be disabled. 
              They store your session and security tokens.
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2">
              Analytics & Performance
            </h3>
            <p className="text-sm text-green-800 dark:text-green-300">
              We use privacy-focused analytics to understand how our service is used and improve performance. 
              No personal data is collected.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Our Commitment to Privacy
          </h3>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li>• Documents are processed temporarily and never stored permanently</li>
            <li>• All data is encrypted in transit and at rest</li>
            <li>• We don't sell or share your data with third parties</li>
            <li>• You can delete your analysis results at any time</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            onClick={handleAccept}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Accept & Continue
          </button>
          <a
            href="/privacy"
            className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-medium py-3 px-6 rounded-lg transition-colors text-center"
          >
            Learn More
          </a>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          By continuing, you agree to our use of cookies as described above. 
          You can change your preferences anytime in our privacy policy.
        </p>
      </div>
    </div>
  );
}

// Empty component since we handle consent in the page flow
export function CookieConsent() {
  return null;
}