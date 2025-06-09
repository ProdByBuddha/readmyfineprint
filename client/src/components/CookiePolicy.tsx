import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cookie, CheckCircle, X, Shield } from "lucide-react";
import { useCookieConsent } from "@/components/CookieConsent";

export function CookiePolicy() {
  const { isAccepted, acceptCookies, revokeCookies } = useCookieConsent();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Cookie Policy</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-blue-600" />
            Simple Cookie Approach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            ReadMyFinePrint uses a minimal, privacy-first approach to cookies. We only use
            <strong> essential cookies</strong> required for basic functionality. No tracking,
            no analytics, no advertising cookies.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Cookies We Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">consent-accepted</h4>
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded">Essential</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Remembers that you've accepted our legal disclaimer and cookie policy.
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  <strong>Duration:</strong> Persistent • <strong>Type:</strong> First-party
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">app-session-id</h4>
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded">Essential</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Manages your browser session for document processing and storage.
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  <strong>Duration:</strong> Session only • <strong>Type:</strong> First-party
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">theme-preference</h4>
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded">Essential</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Saves your dark/light mode preference for a better user experience.
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  <strong>Duration:</strong> Persistent • <strong>Type:</strong> First-party
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <X className="w-5 h-5 text-red-600" />
              What We Don't Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-gray-700 dark:text-gray-300">No tracking cookies</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-gray-700 dark:text-gray-300">No advertising cookies</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-gray-700 dark:text-gray-300">No analytics cookies</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-gray-700 dark:text-gray-300">No social media cookies</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-gray-700 dark:text-gray-300">No third-party tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-gray-700 dark:text-gray-300">No cross-site cookies</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Cookie Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                Cookie Consent Status
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isAccepted
                  ? "You have accepted essential cookies"
                  : "You have not yet accepted cookies"
                }
              </p>
            </div>
            <div className="flex gap-2">
              {!isAccepted ? (
                <Button onClick={acceptCookies} className="bg-green-600 hover:bg-green-700">
                  Accept Cookies
                </Button>
              ) : (
                <Button onClick={revokeCookies} variant="outline">
                  Reset Preferences
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Cookie Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Security Measures</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>All cookies are marked as Secure when served over HTTPS</li>
              <li>Session cookies expire when you close your browser</li>
              <li>No sensitive information is stored in cookies</li>
              <li>Cookies are only accessible to our domain</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Browser Controls</h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              You can control cookies through your browser settings. However, disabling essential
              cookies may affect the functionality of ReadMyFinePrint. Most browsers allow you to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>View and delete cookies</li>
              <li>Block cookies from specific sites</li>
              <li>Block third-party cookies</li>
              <li>Clear cookies when browser closes</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Questions About Cookies?
          </h4>
          <p className="text-blue-800 dark:text-blue-300 text-sm">
            Our cookie policy is designed to be simple and transparent. We believe in using
            only what's necessary for a great user experience. If you have questions about
            our cookie practices, please contact us through our support channels.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
