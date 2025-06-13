import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, Clock, Trash2, Lock, Globe } from "lucide-react";
import { SecurityBadges } from "@/components/SecurityBadges";

export function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Privacy-First Approach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            ReadMyFinePrint is designed with privacy as a core principle. We operate as a
            <strong> session-based tool</strong> that processes documents temporarily without
            permanent storage of your content.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              What We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Document Content</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Temporarily processed for analysis only. Automatically deleted when you refresh the page.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Consent Records</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pseudonymized logs of your agreement to our terms (required for legal compliance).
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Technical Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session IDs, hashed IP addresses, and browser fingerprints for service functionality.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Data Retention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Document Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>0 minutes</strong> - Cleared immediately when you refresh the page.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Session Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>30 minutes</strong> - Automatically cleaned up after inactivity.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Consent Records</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Indefinitely</strong> - Required for legal compliance (pseudonymized).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Data Processing & AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Document Analysis</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Your documents are processed using OpenAI&apos;s API to provide analysis and summaries.
              We recommend avoiding highly sensitive personal information.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>Documents sent to OpenAI for analysis processing</li>
              <li>OpenAI may retain data according to their privacy policy</li>
              <li>We do not permanently store your document content</li>
              <li>Analysis results are temporary and session-based</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-purple-600" />
            Your Rights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Data Control</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Clear all data by refreshing the page</li>
                <li>No account deletion needed (no accounts stored)</li>
                <li>Session data expires automatically</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Consent Verification</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Verify your consent record with your token</li>
                <li>Request pseudonymized consent data</li>
                <li>No personal data linked to consent records</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Cookies & Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Essential Cookies Only</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              We use minimal, essential cookies for basic functionality. No tracking or advertising cookies.
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2">Cookie</th>
                    <th className="text-left py-2">Purpose</th>
                    <th className="text-left py-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 dark:text-gray-400">
                  <tr>
                    <td className="py-1">consent-accepted</td>
                    <td className="py-1">Remember legal disclaimer acceptance</td>
                    <td className="py-1">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-1">app-session-id</td>
                    <td className="py-1">Session management</td>
                    <td className="py-1">Session only</td>
                  </tr>
                  <tr>
                    <td className="py-1">theme-preference</td>
                    <td className="py-1">Dark/light mode setting</td>
                    <td className="py-1">Persistent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <SecurityBadges variant="privacy" />
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Questions About Privacy?
          </h4>
          <p className="text-blue-800 dark:text-blue-300 text-sm">
            Our privacy-first approach means we collect minimal data and store nothing permanently.
            If you have questions about our data practices, please contact us through our support channels at <a href="mailto:admin@readmyfineprint.com">admin@readmyfineprint.com</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
