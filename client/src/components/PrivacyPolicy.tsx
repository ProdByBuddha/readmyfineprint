import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, Clock, Trash2, Lock, Globe } from "lucide-react";
import { SecurityBadges } from "@/components/SecurityBadges";

export function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Privacy Policy
        </h1>
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
            ReadMyFinePrint is designed with privacy as a core principle. We
            operate with both
            <strong> session-based document processing</strong> and{" "}
            <strong>user account management</strong>{" "}
            for subscription services, ensuring your document content remains
            temporary while providing secure access to premium features.
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
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Document Content
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Temporarily processed for analysis only. Automatically deleted
                when you refresh the page.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Account Information
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Email addresses and usernames for registered users. Required for
                subscription management and account recovery.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Payment Information
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Processed securely through Stripe. We store Stripe customer IDs
                but not credit card details.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Usage Analytics
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Documents analyzed, tokens used, and subscription activity for
                service optimization and billing.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Security & Technical Data
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session IDs, hashed IP addresses, device fingerprints, and
                security logs for fraud prevention.
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
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Document Data
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>0 minutes</strong> - Cleared immediately when you
                refresh the page.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Session Data
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>30 minutes</strong> - Automatically cleaned up after
                inactivity.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Account Data
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Until deletion</strong> - User accounts stored for
                subscription management.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Usage Records
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>6 months</strong> - For billing, analytics, and service
                improvement.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Security Logs
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>90 days</strong> - Automatically purged for system
                security monitoring.
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
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Document Analysis with PII Protection
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Your documents are automatically scanned for sensitive information before AI analysis.
              We use advanced PII detection to protect your privacy during document processing.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><strong>Automatic PII Detection:</strong> Every document scanned for SSNs, credit cards, emails, phones, addresses, names, and dates</li>
              <li><strong>Pre-Analysis Redaction:</strong> Sensitive information replaced with secure placeholders before OpenAI processing</li>
              <li><strong>Privacy-First Processing:</strong> Only redacted content sent to OpenAI - your PII never exposed to external AI</li>
              <li><strong>Content Restoration:</strong> Original information restored in your final analysis results</li>
              <li><strong>Mandatory Protection:</strong> PII detection always enabled for maximum privacy protection</li>
              <li>OpenAI processes only anonymized content and may retain data according to their privacy policy</li>
              <li>We do not permanently store your document content</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Payment Processing
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Subscription payments are processed securely through Stripe, a
              PCI-compliant payment processor.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>Payment data handled exclusively by Stripe</li>
              <li>
                We store only Stripe customer IDs for subscription management
              </li>
              <li>Credit card details never stored on our servers</li>
              <li>
                Billing information subject to Stripe&apos;s privacy policy
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Email Communications
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              We may send service-related emails for account verification,
              subscription updates, and security notifications.
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

      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Advanced PII Privacy Protection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Enterprise-Grade PII Detection</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Every document uploaded to ReadMyFinePrint undergoes mandatory, automatic scanning for personally identifiable information using advanced pattern recognition and machine learning.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><strong>Social Security Numbers (SSN):</strong> Detects all SSN formats with 90% confidence threshold</li>
              <li><strong>Credit Card Numbers:</strong> Identifies all major card formats with secure validation</li>
              <li><strong>Email Addresses:</strong> High-accuracy email pattern detection (95% confidence)</li>
              <li><strong>Phone Numbers:</strong> Multiple format recognition including international numbers</li>
              <li><strong>Physical Addresses:</strong> Street address pattern detection with geographic validation</li>
              <li><strong>Personal Names:</strong> Common name database matching with contextual analysis</li>
              <li><strong>Dates of Birth:</strong> Multiple date format recognition for DOB protection</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Zero-Exposure AI Processing</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Your sensitive information never reaches external AI services. Our privacy-first architecture ensures complete PII protection:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><strong>Pre-Processing Redaction:</strong> PII replaced with cryptographically secure placeholders before AI analysis</li>
              <li><strong>Placeholder Mapping:</strong> Secure, temporary mapping system maintains document structure while protecting data</li>
              <li><strong>AI Anonymization:</strong> OpenAI processes only completely anonymized content with no access to original PII</li>
              <li><strong>Post-Processing Restoration:</strong> Original information securely restored in your final analysis results</li>
              <li><strong>Memory Isolation:</strong> PII detection and restoration occur in isolated, secure memory spaces</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Configurable Protection Levels</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              While PII protection is always enabled, the system includes advanced configuration options:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><strong>Confidence Thresholds:</strong> Adjustable detection sensitivity (default: 70% minimum confidence)</li>
              <li><strong>Custom Patterns:</strong> Support for organization-specific sensitive data patterns</li>
              <li><strong>Overlap Resolution:</strong> Intelligent handling of overlapping PII matches with confidence scoring</li>
              <li><strong>Performance Optimization:</strong> Real-time processing with minimal impact on analysis speed</li>
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
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Document Data Control
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Clear document data by refreshing the page</li>
                <li>Documents never permanently stored</li>
                <li>Session data expires automatically</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Account Management
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>View and update your account information</li>
                <li>Cancel subscriptions at any time</li>
                <li>Request account deletion via email recovery</li>
                <li>Download your usage data</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Data Access Rights
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Request copies of your personal data</li>
                <li>Correct inaccurate account information</li>
                <li>Object to certain data processing</li>
                <li>Data portability for subscription data</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Email Recovery
              </h4>
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
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Essential Cookies Only
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              We use minimal, essential cookies for basic functionality. No
              tracking or advertising cookies.
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
                    <td className="py-1">
                      Remember legal disclaimer acceptance
                    </td>
                    <td className="py-1">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-1">app-session-id</td>
                    <td className="py-1">Document session management</td>
                    <td className="py-1">Session only</td>
                  </tr>
                  <tr>
                    <td className="py-1">subscriptionToken</td>
                    <td className="py-1">
                      User authentication and subscription access
                    </td>
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
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Third-Party Cookies
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>
                  <strong>Stripe:</strong> Payment processing and fraud
                  prevention
                </li>
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
            Our privacy-first approach means we collect minimal data and store
            nothing permanently. If you have questions about our data practices,
            please contact us through our support channels at{" "}
            <a href="mailto:admin@readmyfineprint.com">
              admin@readmyfineprint.com
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
