import { useState, useEffect } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { logConsent } from "@/lib/api";

interface LegalDisclaimerProps {
  onAccept: () => void;
}

export function LegalDisclaimer({ onAccept }: LegalDisclaimerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadLiability, setHasReadLiability] = useState(false);
  const [hasReadNoAdvice, setHasReadNoAdvice] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    // Check if user has already accepted the disclaimer
    const hasAccepted = localStorage.getItem('readmyfineprint-disclaimer-accepted');
    if (!hasAccepted) {
      setIsOpen(true);
    } else {
      onAccept();
    }
  }, [onAccept]);

  const handleAccept = async () => {
    setIsLogging(true);

    try {
      // Log consent to server (anonymous, PII-protected)
      const result = await logConsent();

      // Store acceptance locally regardless of server logging result
      const acceptanceDate = new Date().toISOString();
      localStorage.setItem('readmyfineprint-disclaimer-accepted', 'true');
      localStorage.setItem('readmyfineprint-disclaimer-date', acceptanceDate);

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
    } finally {
      setIsLogging(false);
      setIsOpen(false);
      onAccept();
    }
  };

  const canAccept = hasReadTerms && hasReadLiability && hasReadNoAdvice;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-[90vw] h-[75vh] max-w-lg max-h-[600px] p-0 m-0 rounded-xl shadow-xl" hideCloseButton>
        <div className="flex flex-col h-full bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 rounded-xl overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="text-amber-600 dark:text-amber-400 h-4 w-4" />
              </div>
              Legal Consent Required
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Please review and acknowledge these terms before proceeding.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="space-y-3">
              <Card className="border border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-800/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="no-advice"
                      checked={hasReadNoAdvice}
                      onCheckedChange={(checked) => setHasReadNoAdvice(checked as boolean)}
                      className="w-4 h-4 mt-0.5 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    />
                    <div>
                      <label htmlFor="no-advice" className="text-xs font-medium cursor-pointer text-gray-800 dark:text-gray-200 leading-relaxed">
                        I understand this is <strong className="text-amber-700 dark:text-amber-300">NOT legal advice</strong> and will consult an attorney for legal decisions.
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-red-200/60 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 dark:border-red-800/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="liability"
                      checked={hasReadLiability}
                      onCheckedChange={(checked) => setHasReadLiability(checked as boolean)}
                      className="w-4 h-4 mt-0.5 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                    />
                    <div>
                      <label htmlFor="liability" className="text-xs font-medium cursor-pointer text-gray-800 dark:text-gray-200 leading-relaxed">
                        I accept <strong className="text-red-700 dark:text-red-300">AI analysis may contain errors</strong> and use this service at my own risk.
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-blue-200/60 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 dark:border-blue-800/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="terms"
                      checked={hasReadTerms}
                      onCheckedChange={(checked) => setHasReadTerms(checked as boolean)}
                      className="w-4 h-4 mt-0.5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <div>
                      <label htmlFor="terms" className="text-xs font-medium cursor-pointer text-gray-800 dark:text-gray-200 leading-relaxed">
                        I agree to the <strong className="text-blue-700 dark:text-blue-300">Terms of Service</strong> and understand documents are processed by AI services.
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <DialogFooter className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="space-y-2 w-full">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">
                Acceptance logged anonymously for compliance.{' '}
                <a href="/privacy" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors" target="_blank">
                  Privacy
                </a>{' '}
                •{' '}
                <a href="/terms" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors" target="_blank">
                  Terms
                </a>
              </div>
              <Button
                onClick={handleAccept}
                disabled={!canAccept || isLogging}
                className={`w-full h-9 text-xs font-medium transition-all duration-200 ${
                  canAccept 
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-sm hover:shadow-md' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLogging ? (
                  <>
                    <div className="w-3 h-3 mr-2 border border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-3 w-3" />
                    Accept & Continue
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}