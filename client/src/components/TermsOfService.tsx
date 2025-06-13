import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Scale, Shield, FileText, Globe, Clock } from "lucide-react";

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
              <li>Session-based processing without permanent storage</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What We Don't Provide</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>Legal advice or professional legal opinions</li>
              <li>Binding legal interpretations</li>
              <li>Guarantees of document completeness or accuracy</li>
              <li>Professional attorney-client relationships</li>
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
              <h4 className="font-semibold text-gray-900 dark:text-white">Document Security</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Avoid uploading highly sensitive or confidential documents. Consider redacting personal information.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Appropriate Use</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use the service for legitimate document analysis purposes only.
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
              <h4 className="font-semibold text-gray-900 dark:text-white">Hold Harmless</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You agree to hold ReadMyFinePrint harmless from any decisions made based on our analysis.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Maximum Liability</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Our liability is limited to the cost of the service (currently free).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Session-Based Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Temporary Processing</h4>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              ReadMyFinePrint operates as a session-based service. Your documents and analysis results are:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Processed temporarily during your browser session</li>
              <li>Automatically deleted when you refresh the page</li>
              <li>Not stored permanently on our servers</li>
              <li>Isolated to your specific browser session</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Third-Party Processing</h4>
            <p className="text-gray-700 dark:text-gray-300">
              Documents are processed using OpenAI&apos;s API for analysis. By using our service, you acknowledge
              that your document content may be subject to OpenAI&apos;s terms of service and privacy policy.
            </p>
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
                <li>Personal document review</li>
                <li>Business contract analysis</li>
                <li>Educational purposes</li>
                <li>General legal document understanding</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">❌ Prohibited Uses</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Illegal or fraudulent activities</li>
                <li>Uploading others' confidential documents without permission</li>
                <li>Attempting to reverse-engineer the service</li>
                <li>Overloading or disrupting the service</li>
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