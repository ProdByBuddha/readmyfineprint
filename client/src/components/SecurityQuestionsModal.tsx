import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield } from 'lucide-react';
import { SecurityQuestionsSetup } from './SecurityQuestionsSetup';

interface SecurityQuestionsModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose?: () => void;
  title?: string;
  description?: string;
  allowClose?: boolean;
}

export function SecurityQuestionsModal({
  isOpen,
  onComplete,
  onClose,
  title = "Security Questions Required",
  description = "To enhance your account security and continue using our services, please set up security questions.",
  allowClose = false
}: SecurityQuestionsModalProps) {
  const [error, setError] = useState<string | null>(null);

  const handleSetupComplete = () => {
    setError(null);
    onComplete();
  };

  const handleSetupError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleClose = () => {
    if (allowClose && onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={allowClose ? handleClose : undefined}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={allowClose ? undefined : (e) => e.preventDefault()}
        onEscapeKeyDown={allowClose ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <Shield className="h-6 w-6 text-orange-600" />
          </div>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {!allowClose && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Security questions are required to continue. This helps protect your account and enables account recovery options.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4">
          <SecurityQuestionsSetup
            onComplete={handleSetupComplete}
            onSkip={allowClose ? onClose : undefined}
            showSkipOption={allowClose}
            title=""
            description=""
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}