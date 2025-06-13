import { useState, useEffect } from "react";
import { AlertTriangle, Cookie, Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { logConsent } from "@/lib/api";

interface CombinedConsentProps {
  onAccept: () => void;
}

// Combined hook for managing both legal and cookie consent
export function useCombinedConsent() {
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    const legalAccepted = localStorage.getItem('readmyfineprint-disclaimer-accepted');
    const cookiesAccepted = localStorage.getItem('cookie-consent-accepted');
    setIsAccepted(legalAccepted === 'true' && cookiesAccepted === 'true');
  }, []);

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

export function CombinedConsent({ onAccept }: CombinedConsentProps) {
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadLiability, setHasReadLiability] = useState(false);
  const [hasReadCookies, setHasReadCookies] = useState(false);
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
      onAccept();
    }
  };

  const canAccept = hasReadTerms && hasReadLiability && hasReadCookies;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Cookie className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Terms & Privacy Agreement
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Please review and accept our terms to use ReadMyFinePrint
          </p>
        </div>

        <div className="space-y-4">
          {/* Legal Disclaimer Section */}
          <Card className="border border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-800/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="no-advice"
                  checked={hasReadTerms}
                  onCheckedChange={(checked) => setHasReadTerms(checked as boolean)}
                  className="w-4 h-4 mt-1 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                />
                <div className="flex-1">
                  <label htmlFor="no-advice" className="text-sm font-medium text-amber-900 dark:text-amber-200 cursor-pointer">
                    Not Legal Advice
                  </label>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                    I understand this service provides informational summaries only, not legal advice. 
                    For legal decisions, I should consult a qualified attorney.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-red-200/60 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 dark:border-red-800/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="liability"
                  checked={hasReadLiability}
                  onCheckedChange={(checked) => setHasReadLiability(checked as boolean)}
                  className="w-4 h-4 mt-1 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                />
                <div className="flex-1">
                  <label htmlFor="liability" className="text-sm font-medium text-red-900 dark:text-red-200 cursor-pointer">
                    Limitation of Liability
                  </label>
                  <p className="text-xs text-red-800 dark:text-red-300 mt-1">
                    I acknowledge this is an educational tool. The service and its creators are not liable 
                    for decisions made based on AI-generated summaries.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cookie Consent Section */}
          <Card className="border border-blue-200/60 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 dark:border-blue-800/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="cookies"
                  checked={hasReadCookies}
                  onCheckedChange={(checked) => setHasReadCookies(checked as boolean)}
                  className="w-4 h-4 mt-1 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <div className="flex-1">
                  <label htmlFor="cookies" className="text-sm font-medium text-blue-900 dark:text-blue-200 cursor-pointer">
                    Essential Cookies & Privacy
                  </label>
                  <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                    I consent to essential cookies for functionality (session, security). 
                    No tracking or advertising cookies are used.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Summary */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
              Our Privacy Promise
            </h3>
            <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <li>• Documents processed temporarily, never stored permanently</li>
              <li>• All data encrypted in transit and at rest</li>
              <li>• No data sharing with third parties</li>
              <li>• You control your analysis results</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={handleAccept}
            disabled={!canAccept || isLogging}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLogging ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </div>
            ) : canAccept ? (
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Accept All & Continue
              </div>
            ) : (
              "Please review all sections above"
            )}
          </Button>
          
          <div className="flex gap-2">
            <a
              href="/terms"
              className="flex-1 text-center bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-900 dark:text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Terms of Service
            </a>
            <a
              href="/privacy"
              className="flex-1 text-center bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-900 dark:text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Privacy Policy
            </a>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          By accepting, you agree to our terms and acknowledge the disclaimers above.
        </p>
      </div>
    </div>
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