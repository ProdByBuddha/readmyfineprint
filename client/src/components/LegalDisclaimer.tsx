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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="text-amber-500" />
            Important Legal Notice
          </DialogTitle>
          <DialogDescription>Please read and acknowledge the following important information before using ReadMyFinePrint.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="no-advice"
                  checked={hasReadNoAdvice}
                  onCheckedChange={(checked) => setHasReadNoAdvice(checked as boolean)}
                />
                <div className="space-y-2">
                  <label htmlFor="no-advice" className="text-sm font-medium cursor-pointer">
                    Not Legal Advice
                  </label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    ReadMyFinePrint is an AI-powered tool designed to help you understand legal documents.
                    <strong> The analysis provided is NOT legal advice</strong> and should not be relied upon
                    as a substitute for consultation with a qualified attorney. We strongly recommend
                    consulting with a licensed attorney for any legal matters or before making any
                    legal decisions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="liability"
                  checked={hasReadLiability}
                  onCheckedChange={(checked) => setHasReadLiability(checked as boolean)}
                />
                <div className="space-y-2">
                  <label htmlFor="liability" className="text-sm font-medium cursor-pointer">
                    Limitation of Liability & Hold Harmless
                  </label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    By using ReadMyFinePrint, you agree to <strong>hold harmless and indemnify</strong> ReadMyFinePrint, its developers, and associated parties from any claims, damages,
                    losses, or liabilities arising from your use of this service or any decisions
                    made based on the analysis provided. We make no warranties regarding the
                    accuracy, completeness, or reliability of the analysis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={hasReadTerms}
                  onCheckedChange={(checked) => setHasReadTerms(checked as boolean)}
                />
                <div className="space-y-2">
                  <label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                    Data Handling & Session-Based Tool
                  </label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    ReadMyFinePrint is a <strong>session-based tool</strong>. Documents are processed temporarily
                    and are never permanently stored. All analysis data is cleared when you refresh the page.
                    Documents are processed using AI services, so avoid uploading highly sensitive information.
                    <strong>Your consent to these terms is logged anonymously</strong> (without any personal information)
                    for compliance purposes, and stored locally to avoid repeated prompts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex flex-col gap-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Your acceptance is logged anonymously for compliance. No personal data is stored with your consent record.
            <br />
            Read our full{' '}
            <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline" target="_blank">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/terms" className="text-blue-600 hover:text-blue-700 underline" target="_blank">
              Terms of Service
            </a>
          </div>
          <Button
            onClick={handleAccept}
            disabled={!canAccept || isLogging}
            className="w-full"
          >
            <Check className="mr-2 h-4 w-4" />
            {isLogging ? 'Processing...' : 'I Understand and Accept These Terms'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
