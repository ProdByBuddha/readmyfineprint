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
      <DialogContent className="w-[90vw] h-[75vh] max-w-lg max-h-[600px] p-0 m-0" hideCloseButton>
        <div className="flex flex-col h-full">
          <DialogHeader className="px-3 py-2 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="text-amber-500 h-4 w-4" />
              Important Legal Notice
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please read and acknowledge the following before using ReadMyFinePrint.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-3 py-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="space-y-2">
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="p-2">
                  <div className="flex items-start gap-1.5">
                    <Checkbox
                      id="no-advice"
                      checked={hasReadNoAdvice}
                      onCheckedChange={(checked) => setHasReadNoAdvice(checked as boolean)}
                      className="w-3 h-3 mt-0.5"
                    />
                    <div className="space-y-1">
                      <label htmlFor="no-advice" className="text-xs font-medium cursor-pointer">
                        Not Legal Advice
                      </label>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        ReadMyFinePrint is an AI-powered tool designed to help you understand legal documents.
                        <strong> The analysis provided is NOT legal advice</strong> and should not be relied upon
                        as a substitute for consultation with a qualified attorney.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                <CardContent className="p-2">
                  <div className="flex items-start gap-1.5">
                    <Checkbox
                      id="liability"
                      checked={hasReadLiability}
                      onCheckedChange={(checked) => setHasReadLiability(checked as boolean)}
                      className="w-3 h-3 mt-0.5"
                    />
                    <div className="space-y-1">
                      <label htmlFor="liability" className="text-xs font-medium cursor-pointer">
                        No Liability for Analysis Accuracy
                      </label>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        While we strive for accuracy, AI analysis may contain errors or miss important details.
                        <strong> We cannot guarantee the completeness or accuracy of any analysis.</strong> You use
                        this service at your own risk.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                <CardContent className="p-2">
                  <div className="flex items-start gap-1.5">
                    <Checkbox
                      id="terms"
                      checked={hasReadTerms}
                      onCheckedChange={(checked) => setHasReadTerms(checked as boolean)}
                      className="w-3 h-3 mt-0.5"
                    />
                    <div className="space-y-1">
                      <label htmlFor="terms" className="text-xs font-medium cursor-pointer">
                        Terms of Service & Privacy Policy
                      </label>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        By using this service, you agree to our Terms of Service and Privacy Policy.
                        Documents are processed using AI services, so avoid uploading highly sensitive information.
                        <strong> Your consent is logged anonymously</strong> for compliance purposes.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <DialogFooter className="px-3 py-2 border-t shrink-0 space-y-1">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">
              Your acceptance is logged anonymously for compliance.{' '}
              <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline" target="_blank">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="/terms" className="text-blue-600 hover:text-blue-700 underline" target="_blank">
                Terms
              </a>
            </div>
            <Button
              onClick={handleAccept}
              disabled={!canAccept || isLogging}
              className="w-full h-8 text-xs"
            >
              <Check className="mr-1 h-3 w-3" />
              {isLogging ? 'Processing...' : 'I Accept These Terms'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}