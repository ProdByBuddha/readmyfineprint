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
            ReadMyFinePrint is designed with privacy as a core principle. We operate with both
            <strong> session-based document processing</strong> and <strong>user account management</strong> 
            for subscription services, ensuring your document content remains temporary while
            providing secure access to premium features.
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
              <h4 className="font-semibold text-gray-900 dark:text-white">Account Information</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Email addresses and usernames for registered users. Required for subscription management and account recovery.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Payment Information</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Processed securely through Stripe. We store Stripe customer IDs but not credit card details.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Usage Analytics</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Documents analyzed, tokens used, and subscription activity for service optimization and billing.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Security & Technical Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session IDs, hashed IP addresses, device fingerprints, and security logs for fraud prevention.
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
              <h4 className="font-semibold text-gray-900 dark:text-white">Account Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Until deletion</strong> - User accounts stored for subscription management.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Usage Records</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>6 months</strong> - For billing, analytics, and service improvement.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Security Logs</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>90 days</strong> - Automatically purged for system security monitoring.
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
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Payment Processing</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Subscription payments are processed securely through Stripe, a PCI-compliant payment processor.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>Payment data handled exclusively by Stripe</li>
              <li>We store only Stripe customer IDs for subscription management</li>
              <li>Credit card details never stored on our servers</li>
              <li>Billing information subject to Stripe&apos;s privacy policy</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Email Communications</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              We may send service-related emails for account verification, subscription updates, and security notifications.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>Account verification and security notifications</li>
              <li>Subscription status and billing updates</li>
              <li>Email recovery assistance when requested</li>
              <li>No marketing emails without explicit consent</li>
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
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Document Data Control</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Clear document data by refreshing the page</li>
                <li>Documents never permanently stored</li>
                <li>Session data expires automatically</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Account Management</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>View and update your account information</li>
                <li>Cancel subscriptions at any time</li>
                <li>Request account deletion via email recovery</li>
                <li>Download your usage data</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Data Access Rights</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Request copies of your personal data</li>
                <li>Correct inaccurate account information</li>
                <li>Object to certain data processing</li>
                <li>Data portability for subscription data</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Email Recovery</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Secure email change requests</li>
                <li>Account recovery assistance</li>
                <li>Multi-device access management</li>
                <li>Token-based authentication</li>
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
                    <td className="py-1">Document session management</td>
                    <td className="py-1">Session only</td>
                  </tr>
                  <tr>
                    <td className="py-1">subscriptionToken</td>
                    <td className="py-1">User authentication and subscription access</td>
                    <td className="py-1">30 days</td>
                  </tr>
                  <tr>
                    <td className="py-1">theme-preference</td>
                    <td className="py-1">Dark/light mode setting</td>
                    <td className="py-1">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-1">cookie-preferences</td>
                    <td className="py-1">Remember cookie consent choices</td>
                    <td className="py-1">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Third-Party Cookies</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li><strong>Stripe:</strong> Payment processing and fraud prevention</li>
                <li><strong>Replit:</strong> Development environment (development mode only)</li>
                <li>No advertising or tracking cookies from third parties</li>
              </ul>
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