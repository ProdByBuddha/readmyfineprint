import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield, X } from 'lucide-react';
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px is sm breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  if (!isOpen) return null;

  // Mobile version - Full screen
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-800">
        <div className="flex flex-col h-full bg-white dark:bg-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30" dark:text-gray-100>
                <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            </div>
            {allowClose && onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-900 dark:text-white" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>

            {!allowClose && (
              <Alert className="bg-blue-50 dark:bg-blue-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-gray-700 dark:text-gray-200">
                  Security questions are required to continue. This helps protect your account and enables account recovery options.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-700 dark:text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            <SecurityQuestionsSetup
              onComplete={handleSetupComplete}
              onSkip={allowClose ? onClose : undefined}
              showSkipOption={allowClose}
              title=""
              description=""
              transparent={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // Desktop version - Dialog modal
  return (
    <Dialog open={true} onOpenChange={allowClose ? handleClose : undefined}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        onPointerDownOutside={allowClose ? undefined : (e) => e.preventDefault()}
        onEscapeKeyDown={allowClose ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30" dark:text-gray-100>
            <Shield className="h-6 w-6 text-orange-600 dark:text-orange-400" />
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