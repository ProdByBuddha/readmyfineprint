import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Scale, Shield, FileText, Globe, Clock, DollarSign } from "lucide-react";

export function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Important Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-amber-800 dark:text-amber-200">
            <strong>ReadMyFinePrint is NOT a substitute for professional legal advice.</strong>
            This tool provides AI-powered document analysis for informational purposes only.
            Always consult with a qualified attorney for legal matters.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Service Description
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What We Provide</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>AI-powered document analysis and summarization</li>
              <li>Plain English explanations of legal document content</li>
              <li>Risk assessment and key findings identification</li>
              <li>User accounts and subscription management</li>
              <li>Multi-device access with secure authentication</li>
              <li>Email recovery and account management services</li>
              <li>Session-based document processing (documents not permanently stored)</li>
              <li>Secure payment processing through Stripe</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What We Don't Provide</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>Legal advice or professional legal opinions</li>
              <li>Binding legal interpretations</li>
              <li>Guarantees of document completeness or accuracy</li>
              <li>Professional attorney-client relationships</li>
              <li>Permanent storage of your document content</li>
              <li>Guarantee of uninterrupted service availability</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-600" />
              Your Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Account Security</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Keep your account credentials secure. Report any unauthorized access immediately.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Document Security</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Avoid uploading highly sensitive or confidential documents. Consider redacting personal information.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Payment Obligations</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pay subscription fees on time. Cancel subscriptions before renewal to avoid charges.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Appropriate Use</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use the service for legitimate document analysis purposes only. Respect usage limits.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Legal Consultation</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Consult qualified legal professionals for important legal decisions.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Limitation of Liability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Service Limitations</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI analysis may contain errors or omissions. Results are not guaranteed to be complete or accurate.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Payment Processing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Payment issues are handled by Stripe. We are not liable for payment processing errors.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Data Security</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                While we implement security measures, we cannot guarantee absolute security of your data.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Hold Harmless</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You agree to hold ReadMyFinePrint harmless from any decisions made based on our analysis.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Maximum Liability</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Our liability is limited to the amount paid for the service in the last 12 months.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Service Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Document Processing</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Document analysis operates on a session-based model. Your documents and analysis results are:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Processed temporarily during your browser session</li>
              <li>Automatically deleted when you refresh the page</li>
              <li>Not stored permanently on our servers</li>
              <li>Isolated to your specific browser session</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Account Services</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              User accounts and subscription data are stored securely for service delivery:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Account information stored for subscription management</li>
              <li>Usage data tracked for billing and analytics</li>
              <li>Multi-device authentication tokens managed securely</li>
              <li>Email recovery and account management available</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Third-Party Services</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              We integrate with trusted third-party services:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li><strong>OpenAI:</strong> Document analysis processing (subject to OpenAI&apos;s terms)</li>
              <li><strong>Stripe:</strong> Payment processing and billing management</li>
              <li><strong>Email Services:</strong> Account verification and notifications</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Subscription Terms & Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Subscription Plans</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Free tier with limited monthly document analysis</li>
              <li>Paid subscription plans with increased limits and features</li>
              <li>Subscription details and pricing available on our pricing page</li>
              <li>Plans subject to change with reasonable notice</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Billing & Payments</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Subscriptions billed automatically through Stripe</li>
              <li>Charges processed at the beginning of each billing cycle</li>
              <li>Failed payments may result in service suspension</li>
              <li>Refunds handled according to our refund policy</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Cancellation</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Cancel subscriptions at any time through your account</li>
              <li>Service continues until the end of the current billing period</li>
              <li>No partial refunds for unused time</li>
              <li>Account data retained for reasonable period after cancellation</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Acceptable Use Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">✅ Permitted Uses</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Personal document review and analysis</li>
                <li>Business contract analysis</li>
                <li>Educational and research purposes</li>
                <li>General legal document understanding</li>
                <li>Account sharing within reasonable organizational use</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">❌ Prohibited Uses</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Illegal or fraudulent activities</li>
                <li>Uploading others' confidential documents without permission</li>
                <li>Attempting to reverse-engineer or hack the service</li>
                <li>Overloading, disrupting, or abusing the service</li>
                <li>Creating multiple accounts to circumvent usage limits</li>
                <li>Sharing account credentials inappropriately</li>
                <li>Payment fraud or chargebacks abuse</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Availability & Modifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Service Availability</h4>
            <p className="text-gray-700 dark:text-gray-300">
              We strive to provide reliable service but do not guarantee uninterrupted availability.
              The service may be temporarily unavailable for maintenance or updates.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Terms Updates</h4>
            <p className="text-gray-700 dark:text-gray-300">
              We may update these terms periodically. Continued use of the service constitutes
              acceptance of any modifications.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">
            Disclaimer of Warranties
          </h4>
          <p className="text-red-800 dark:text-red-300 text-sm">
            THIS SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES,
            EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            AND NON-INFRINGEMENT. USE AT YOUR OWN RISK.
          </p>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Contact & Governing Law
          </h4>
          <p className="text-blue-800 dark:text-blue-300 text-sm">
            These terms are governed by applicable law. For questions about these terms,
            please contact us through our support channels at <a href="mailto:admin@readmyfineprint.com">admin@readmyfineprint.com</a>. By using ReadMyFinePrint,
            you agree to these terms and conditions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}