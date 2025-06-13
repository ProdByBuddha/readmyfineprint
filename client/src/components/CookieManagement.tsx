import { useState } from "react";
import { Cookie, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCombinedConsent } from "@/components/CombinedConsent";
import { Link } from "wouter";

interface CookieManagementProps {
  trigger?: React.ReactNode;
  className?: string;
}

export function CookieManagement({ trigger, className }: CookieManagementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isAccepted, revokeConsent } = useCombinedConsent();

  const handleRevokeAll = () => {
    revokeConsent();
    setIsOpen(false);
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className={className}>
      <Cookie className="w-4 h-4 mr-2" />
      Cookie Settings
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 border dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Shield className="w-5 h-5 text-primary" />
            Cookie Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">Current Status</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                All consents: {isAccepted ? "Accepted" : "Not accepted"}
              </span>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                isAccepted
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              }`}>
                {isAccepted ? "Active" : "Pending"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">What we use cookies for:</h4>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">Essential Functionality</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Session management, security, user preferences</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">Legal Compliance</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Consent tracking for regulatory requirements</div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-3">
              <h5 className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                Privacy Promise
              </h5>
              <ul className="text-xs text-green-800 dark:text-green-300 space-y-1">
                <li>• No tracking or analytics cookies</li>
                <li>• No advertising or marketing cookies</li>
                <li>• No data sharing with third parties</li>
                <li>• Documents processed temporarily only</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {isAccepted ? (
              <Button
                onClick={handleRevokeAll}
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
              >
                Revoke All Consents
              </Button>
            ) : (
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                Visit the main page to provide consent
              </div>
            )}

            <div className="flex gap-2 text-xs">
              <Link
                to="/privacy"
                className="flex-1 text-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-300 ease-in-out"
                onClick={() => {
                  setIsOpen(false);
                  // Scroll to top when navigating
                  setTimeout(() => {
                    const mainContent = document.getElementById('main-content');
                    if (mainContent) {
                      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }, 100);
                }}
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="flex-1 text-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-300 ease-in-out"
                onClick={() => {
                  setIsOpen(false);
                  // Scroll to top when navigating
                  setTimeout(() => {
                    const mainContent = document.getElementById('main-content');
                    if (mainContent) {
                      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }, 100);
                }}
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook version for programmatic access
export function useCookieManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openCookieSettings = () => setIsDialogOpen(true);
  const closeCookieSettings = () => setIsDialogOpen(false);

  return {
    isDialogOpen,
    openCookieSettings,
    closeCookieSettings,
    CookieManagementDialog: () => (
      <CookieManagement />
    )
  };
}
