import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PrivacyPolicy() {
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center">
          Privacy Policy
        </CardTitle>
        <p className="text-center text-muted-foreground mt-2">
          Last Updated: October 1, 2025
        </p>
      </CardHeader>
      <CardContent className="prose dark:prose-invert max-w-none space-y-6">
        
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Introduction</h2>
          <p>
            ReadMyFinePrint ("we," "our," or "us") respects your privacy. This Privacy Policy explains how 
            we collect, use, disclose, and protect your personal information when you use our document analysis 
            services (the "Services").
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Notice at Collection (California)</h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 p-4 rounded-lg">
            <p className="font-semibold mb-2">For California Residents:</p>
            <p>
              We collect the following categories of personal information:
            </p>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li><strong>Identifiers:</strong> Email address and account username</li>
              <li><strong>Payment Information:</strong> Stripe customer ID (payment card data handled solely by Stripe)</li>
              <li><strong>Technical Information:</strong> IP address (hashed or truncated), device fingerprints, session IDs</li>
              <li><strong>Document Statistics:</strong> Token counts, analysis metrics (not document content itself)</li>
              <li><strong>Hashed PII Matches:</strong> Argon2 hashes of PII detected in documents for analytics</li>
            </ol>
            <p className="mt-3">
              <strong>Purpose:</strong> To provide services, authenticate users, prevent fraud, process payments, 
              and improve system performance.
            </p>
            <p className="mt-2">
              <strong>Retention:</strong> Document content held in memory during active sessions (30 min of inactivity); 
              session data 30 minutes; usage records 6 months; security logs 90 days.
            </p>
            <p className="mt-2">
              <strong>Sale/Sharing:</strong> We do <strong>not</strong> sell or share your personal data for 
              cross-context advertising.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">What We Collect & Why</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 mt-4">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Category</th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Examples & Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">Account Information</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    Your email and username; hashed answers to security questions (Argon2); encrypted TOTP 
                    secrets and backup codes. Used for account creation, authentication, and recovery.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">Payment & Subscription Data</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    Stripe customer ID, subscription tier, and billing history. Payment card details are 
                    processed solely by Stripe; we never store card numbers.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">Document & Usage Metrics</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    Document token counts, analysis requests, and results. Used for billing and to improve 
                    accuracy. Raw document content is processed in memory and redacted before being sent to 
                    model providers.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">Security & Technical Data</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    Session IDs, hashed IP addresses, device fingerprints, and logs of authentication attempts. 
                    Used for fraud detection, rate limiting, and security auditing.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">Hashed PII & Analytics</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    Some detectors compute Argon2 hashes of detected PII and analytics summaries for risk 
                    scoring. Used to improve detection accuracy and monitor system health. Raw PII is never 
                    stored.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">How We Process Documents</h2>
          <p>
            We take document privacy seriously and employ advanced PII detection technology:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Automatic PII Detection:</strong> We automatically detect likely PII (names, addresses, 
              social security numbers, etc.) and replace it with secure placeholders before analysis.
            </li>
            <li>
              <strong>Redacted Content Only:</strong> The redacted content (with placeholders) is then analyzed 
              by third-party AI model providers (e.g., OpenAI).
            </li>
            <li>
              <strong>Not Perfect:</strong> PII detection is not 100% accurate. Residual data may be sent to 
              model providers. If the zero-PII analyzer detects high risk, it will warn you.
            </li>
            <li>
              <strong>Third-Party Retention:</strong> Model providers (e.g., OpenAI) typically retain API 
              inputs and outputs for up to 30 days, and longer under legal hold.
            </li>
            <li>
              <strong>No Training on Your Data:</strong> We do not use your documents to train publicly 
              available AI models.
            </li>
          </ul>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 mt-4">
            <p className="font-semibold">⚠️ Important:</p>
            <p className="mt-1">
              You should not upload documents containing highly sensitive information if you cannot accept 
              the risk that some PII might be inadvertently sent to model providers despite our redaction 
              efforts.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Data Retention</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Document Content:</strong> Retained in memory for the duration of your session (up to 30 minutes of inactivity); 
              never stored to disk. Document content is held in memory during your active session and automatically deleted when your session expires after 30 minutes of inactivity. Redaction maps and hashed PII matches may be retained for analytics.
            </li>
            <li>
              <strong>Session Data:</strong> 30 minutes; required to keep you logged in.
            </li>
            <li>
              <strong>Usage Records:</strong> 6 months; used for billing and improving the service.
            </li>
            <li>
              <strong>Security Logs:</strong> IP addresses (hashed or truncated), device fingerprints, and 
              authentication logs retained for 90 days for fraud detection and abuse prevention.
            </li>
            <li>
              <strong>Account Data:</strong> Until you delete your account or as required by law.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">How We Share Your Information</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Third-Party Service Providers:</strong>
              <ul className="list-circle pl-6 mt-1 space-y-1">
                <li>OpenAI (document analysis using redacted text)</li>
                <li>Stripe (payment processing - they handle all card data)</li>
              </ul>
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by law, court order, or government request.
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets 
              (subject to confidentiality obligations).
            </li>
            <li>
              <strong>Fraud Prevention:</strong> To prevent fraud, abuse, or security threats.
            </li>
          </ul>
          <p className="mt-3 font-semibold">
            We do NOT sell your personal information or share it for cross-context advertising.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Security Measures</h2>
          <p>We implement industry-standard security measures:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Encryption in Transit:</strong> All data transmitted to and from our servers is encrypted 
              using TLS/SSL.
            </li>
            <li>
              <strong>Encryption at Rest:</strong> TOTP secrets and backup codes are encrypted using AES-256.
            </li>
            <li>
              <strong>Password Hashing:</strong> Security questions are hashed using Argon2, a memory-hard 
              password hashing algorithm.
            </li>
            <li>
              <strong>Hashed IP Addresses:</strong> IP addresses are hashed or truncated before logging for 
              rate limiting and fraud detection.
            </li>
            <li>
              <strong>Device Fingerprinting:</strong> Used to detect bot activity and prevent multiple accounts 
              from the same device.
            </li>
            <li>
              <strong>Session Management:</strong> Sessions expire after 30 minutes of inactivity.
            </li>
          </ul>
          <p className="mt-3">
            <strong>However, no system is 100% secure.</strong> We cannot guarantee absolute security but 
            continuously work to improve our security posture.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Your Rights & Controls</h2>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">All Users</h3>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Access, correct, or delete your account information through your account settings</li>
            <li>Request deletion of security logs (unless legally required to retain them)</li>
            <li>Export your usage data and analytics</li>
            <li>Opt out of marketing communications (where applicable)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">California Residents (CCPA/CPRA)</h3>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Know what personal information we collect, use, and share</li>
            <li>Request deletion of your personal information (subject to legal exceptions)</li>
            <li>Opt out of sale or sharing for advertising (we don't sell/share for ads)</li>
            <li>Non-discrimination for exercising your rights</li>
            <li>Correct inaccurate personal information</li>
            <li>Limit use of sensitive personal information (where applicable)</li>
          </ul>
          <p className="mt-2">
            <strong>Global Privacy Control (GPC):</strong> We honor GPC and other universal opt-out signals 
            where required by law.
          </p>

          <h3 className="text-xl font-semibold mt-4 mb-2">EEA/UK Residents (GDPR)</h3>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Access your personal data</li>
            <li>Rectification of inaccurate data</li>
            <li>Erasure ("right to be forgotten")</li>
            <li>Data portability</li>
            <li>Object to processing</li>
            <li>Restrict processing</li>
            <li>Withdraw consent (where processing is based on consent)</li>
            <li>Lodge a complaint with your local data protection authority</li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">How to Exercise Your Rights</h3>
          <p>
            Email us at <a href="mailto:privacy@readmyfineprint.com" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@readmyfineprint.com</a> with 
            your request. We will respond within the time period required by applicable law (typically 30-45 days).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">International Transfers</h2>
          <p>
            Your data may be processed in the United States and by third-party providers located in various 
            countries. When transferring data from the European Economic Area (EEA) or United Kingdom, we use:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
            <li>Adequacy decisions where available</li>
            <li>Other appropriate safeguards required by GDPR/UK GDPR</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Children's Privacy</h2>
          <p>
            The Services are not intended for children under 13 years of age. We do not knowingly collect 
            personal information from children under 13. If we become aware that we have collected personal 
            information from a child under 13, we will take steps to delete such information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes by:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Updating the "Last Updated" date at the top of this page</li>
            <li>Sending an email to your registered address for significant changes</li>
            <li>Displaying a prominent in-app notice</li>
          </ul>
          <p className="mt-2">
            We encourage you to review this Privacy Policy periodically.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our privacy practices, please contact us:
          </p>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mt-3">
            <p><strong>Email:</strong> <a href="mailto:privacy@readmyfineprint.com" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@readmyfineprint.com</a></p>
            <p><strong>Website:</strong> <a href="https://readmyfineprint.com" className="text-blue-600 dark:text-blue-400 hover:underline">https://readmyfineprint.com</a></p>
            <p className="mt-2"><strong>Data Protection Officer (DPO) - EEA/UK Inquiries:</strong></p>
            <p>Email: <a href="mailto:dpo@readmyfineprint.com" className="text-blue-600 dark:text-blue-400 hover:underline">dpo@readmyfineprint.com</a></p>
          </div>
        </section>

      </CardContent>
    </Card>
  );
}
