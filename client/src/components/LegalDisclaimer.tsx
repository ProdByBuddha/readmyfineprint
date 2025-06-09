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

interface LegalDisclaimerProps {
  onAccept: () => void;
}

export function LegalDisclaimer({ onAccept }: LegalDisclaimerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadLiability, setHasReadLiability] = useState(false);
  const [hasReadNoAdvice, setHasReadNoAdvice] = useState(false);

  useEffect(() => {
    // Check if user has already accepted the disclaimer
    const hasAccepted = localStorage.getItem('legalclear-disclaimer-accepted');
    if (!hasAccepted) {
      setIsOpen(true);
    } else {
      onAccept();
    }
  }, [onAccept]);

  const handleAccept = () => {
    localStorage.setItem('legalclear-disclaimer-accepted', 'true');
    setIsOpen(false);
    onAccept();
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
                    LegalClear is an AI-powered tool designed to help you understand legal documents. 
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
                    By using LegalClear, you agree to <strong>hold harmless and indemnify</strong> 
                    LegalClear, its developers, and associated parties from any claims, damages, 
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
                    Terms of Use & Data Handling
                  </label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Documents uploaded to LegalClear are processed using AI services. While we 
                    take reasonable measures to protect your data, you acknowledge the risks 
                    inherent in digital processing. Do not upload highly sensitive or confidential 
                    documents. We recommend removing personal identifying information before analysis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex flex-col gap-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Your acceptance will be stored locally and you won't be asked again on this device.
          </div>
          <Button 
            onClick={handleAccept} 
            disabled={!canAccept}
            className="w-full"
          >
            <Check className="mr-2 h-4 w-4" />
            I Understand and Accept These Terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}