import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TouchScrollContainer } from "@/components/TouchScrollContainer";
import { Cookie, Shield, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useCombinedConsent } from "@/components/CombinedConsent";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Cookies() {
  const { isAccepted, acceptAll, revokeConsent, isCheckingConsent } = useCombinedConsent();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Allow page to load even if consent checking is in progress
  useEffect(() => {
    // Give the consent system time to initialize, but don't block the page
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // If still loading, show loading state
  if (isLoading && isCheckingConsent) {
    return (
      <TouchScrollContainer className="h-full bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center">
            <Cookie className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
            <h1 className="text-3xl font-bold mb-2">Loading Cookie Settings...</h1>
            <p className="text-lg text-muted-foreground">
              Please wait while we load your preferences
            </p>
          </div>
        </div>
      </TouchScrollContainer>
    );
  }

  const handleAcceptAndReturn = () => {
    acceptAll();
    navigate('/');
  };

  return (
    <TouchScrollContainer className="h-full bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        <div className="text-center mb-8">
          <Cookie className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Cookie Settings</h1>
          <p className="text-lg text-muted-foreground">
            Manage your cookie preferences for ReadMyFinePrint
          </p>
        </div>

        {/* Current Status */}
        <Card className={`mb-6 ${isAccepted ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-blue-200 bg-blue-50 dark:bg-blue-950/20'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isCheckingConsent ? (
                <Cookie className="h-5 w-5 text-gray-600 animate-pulse" />
              ) : isAccepted ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Cookie className="h-5 w-5 text-blue-600" />
              )}
              Your Cookie Preferences
            </CardTitle>
            <CardDescription>
              {isCheckingConsent 
                ? "Checking your current cookie preferences..."
                : isAccepted 
                ? "You have accepted our essential cookies and can use all features." 
                : "Accept cookies to enable document analysis and full functionality."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Essential Cookies</h4>
                  <p className="text-sm text-muted-foreground">Required for basic functionality, security, and session management</p>
                </div>
                <Badge variant="secondary">Always Active</Badge>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Analytics & Performance</h4>
                  <p className="text-sm text-muted-foreground">Help us understand usage patterns to improve the service</p>
                </div>
                <Badge variant="outline">Privacy-First</Badge>
              </div>

              <div className="flex gap-3 pt-4">
                {isCheckingConsent ? (
                  <Button disabled className="bg-gray-400 flex-1">
                    Checking Status...
                  </Button>
                ) : !isAccepted ? (
                  <Button onClick={handleAcceptAndReturn} className="bg-blue-600 hover:bg-blue-700 flex-1">
                    Accept All & Continue
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => navigate('/')} variant="outline" className="flex-1">
                      Return Home
                    </Button>
                    <Button 
                      onClick={revokeConsent}
                      variant="destructive"
                    >
                      Revoke Consent
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cookie Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              What Cookies We Use
            </CardTitle>
            <CardDescription>
              ReadMyFinePrint uses minimal, essential cookies for functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Essential Session Cookies</h4>
                <Badge>Required</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                These cookies are necessary for the basic functionality of our service.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <code>cookie-consent-accepted</code> - Remembers your cookie preference</li>
                <li>• <code>sessionId</code> - Secure session management for authenticated users</li>
                <li>• Session data - Temporarily stores your uploaded documents during analysis</li>
                <li>• Authentication tokens - Secures API communications</li>
              </ul>
            </div>

            <div className="border rounded-lg p-4 opacity-60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Analytics Cookies</h4>
                <Badge variant="outline">Not Used</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                We do not use analytics or tracking cookies. Your privacy is our priority.
              </p>
            </div>

            <div className="border rounded-lg p-4 opacity-60">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Marketing Cookies</h4>
                <Badge variant="outline">Not Used</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                We do not use marketing or advertising cookies.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">What we DO</h4>
                <ul className="text-sm space-y-1">
                  <li>✓ Store documents in memory during your active session</li>
                  <li>✓ Use memory-only storage (never saved to disk)</li>
                  <li>✓ Clear session data after 30 minutes of inactivity</li>
                  <li>✓ Encrypt all communications</li>
                  <li>✓ Respect your privacy choices</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">What we DON'T do</h4>
                <ul className="text-sm space-y-1">
                  <li>✗ Store documents permanently</li>
                  <li>✗ Track you across websites</li>
                  <li>✗ Share data with third parties</li>
                  <li>✗ Use advertising cookies</li>
                  <li>✗ Collect personal information</li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
              <p className="text-sm">
                <strong>Need more details?</strong> Read our full{' '}
                <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Terms of Service
                </a>{' '}
                for complete information about how we handle your data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TouchScrollContainer>
  );
}