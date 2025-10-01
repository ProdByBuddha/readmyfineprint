import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CookiePolicy() {
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center">
          Cookie & Device Fingerprint Policy
        </CardTitle>
        <p className="text-center text-gray-600 dark:text-gray-300 mt-2">
          Last Updated: October 1, 2025
        </p>
      </CardHeader>
      <CardContent className="prose prose-gray dark:prose-invert dark:text-gray-200 max-w-none space-y-6">
        
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Introduction</h2>
          <p>
            This Cookie Policy explains how ReadMyFinePrint uses cookies, device fingerprints, and similar 
            technologies when you use our Services. By using the Services, you consent to the use of cookies 
            and device fingerprints as described in this policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">What Are Cookies?</h2>
          <p>
            Cookies are small text files stored on your device (computer, tablet, or mobile phone) when you 
            visit a website. They help websites remember your preferences and improve your experience.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Essential Cookies We Use</h2>
          <p>
            We use minimal cookies that are <strong>necessary for core functionality</strong>. These cookies 
            cannot be disabled without affecting the Services.
          </p>
          
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Cookie Name</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Purpose</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono text-sm">consent-accepted</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Stores whether you accepted the legal disclaimer and consent banner.
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Persistent (until you delete it)
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono text-sm">app-session-id</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Manages your document session in memory and ensures documents are processed only 
                    within your session. Essential for security and document handling.
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Session-based (expires after 30 minutes of inactivity, regardless of page refreshes)
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono text-sm">sessionId</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Authenticates your account and provides access to your subscription features.
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    30 days
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono text-sm">theme-preference</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Stores your dark/light mode selection for a consistent visual experience.
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Persistent
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono text-sm">cookie-preferences</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    Records your cookie consent choices (essential, analytics, marketing preferences).
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    1 year
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Device Fingerprints & Hashed IPs</h2>
          <p>
            For fraud prevention and security, we collect technical information beyond cookies:
          </p>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Device Fingerprints</h3>
          <p>
            A device fingerprint is a unique identifier created by combining various characteristics of your 
            browser and device, such as:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Browser type and version</li>
            <li>Operating system</li>
            <li>Screen resolution</li>
            <li>Installed fonts</li>
            <li>Timezone</li>
            <li>Language preferences</li>
          </ul>
          <p className="mt-3">
            <strong>Why we use device fingerprints:</strong>
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Detect suspicious activity (e.g., multiple accounts from the same device)</li>
            <li>Prevent bot attacks and automated abuse</li>
            <li>Enforce rate limits fairly</li>
            <li>Identify session hijacking attempts</li>
          </ul>
          <p className="mt-3">
            <strong>We do NOT use device fingerprints for:</strong>
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Advertising or cross-site tracking</li>
            <li>Building user profiles for marketing</li>
            <li>Sharing with third parties for their own purposes</li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">Hashed IP Addresses</h3>
          <p>
            We hash (cryptographically transform) your IP address and user-agent string before logging them. 
            This means:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Your actual IP address is not stored in our logs</li>
            <li>We can still detect patterns of abuse from the same source</li>
            <li>The hash cannot be reversed to reveal your IP address</li>
          </ul>
          <p className="mt-3">
            Hashed IPs and device fingerprints are retained for <strong>90 days</strong> for security auditing 
            and fraud detection.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Third-Party Cookies</h2>
          <p>
            We integrate with <strong>Stripe</strong> for payment processing. Stripe may set cookies to:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Detect fraudulent transactions</li>
            <li>Manage payment sessions</li>
            <li>Provide secure checkout</li>
          </ul>
          <p className="mt-3">
            These cookies are <strong>necessary for billing</strong> and cannot be disabled if you use paid 
            subscription features. For more information, see <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-300 hover:underline">Stripe's Privacy Policy</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">What We Don't Use</h2>
          <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-500 dark:text-gray-100 p-4" dark:text-gray-100>
            <p className="font-semibold">✅ Your Privacy is Protected:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>❌ No advertising or tracking cookies</li>
              <li>❌ No social media cookies</li>
              <li>❌ No third-party analytics cookies (e.g., Google Analytics)</li>
              <li>❌ No cross-site tracking</li>
              <li>❌ No behavioral profiling for marketing</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Browser Controls</h2>
          <p>
            You have control over cookies and tracking technologies through your browser settings:
          </p>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Managing Cookies</h3>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Chrome:</strong> Settings → Privacy and Security → Cookies and other site data
            </li>
            <li>
              <strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data
            </li>
            <li>
              <strong>Safari:</strong> Preferences → Privacy → Manage Website Data
            </li>
            <li>
              <strong>Edge:</strong> Settings → Privacy, search, and services → Cookies and site permissions
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">Blocking Third-Party Tracking</h3>
          <p>Most modern browsers offer enhanced tracking protection:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Chrome:</strong> Enable "Send a 'Do Not Track' request"</li>
            <li><strong>Firefox:</strong> Enhanced Tracking Protection (enabled by default)</li>
            <li><strong>Safari:</strong> Intelligent Tracking Prevention (enabled by default)</li>
            <li><strong>Edge:</strong> Tracking prevention (enabled by default)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">Browser Extensions</h3>
          <p>
            You can install privacy-focused browser extensions like:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Privacy Badger</li>
            <li>uBlock Origin</li>
            <li>DuckDuckGo Privacy Essentials</li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">Private/Incognito Mode</h3>
          <p>
            Using private/incognito browsing mode prevents cookies from persisting after you close your browser. 
            However, session functionality will be limited.
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500 dark:text-gray-100 p-4 mt-4" dark:text-gray-100>
            <p className="font-semibold">⚠️ Important:</p>
            <p className="mt-1">
              Disabling essential cookies will limit the functionality of the Services. You may not be able to 
              log in, manage subscriptions, or analyze documents if essential cookies are blocked.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Global Privacy Control (GPC)</h2>
          <p>
            We recognize and honor the <strong>Global Privacy Control (GPC)</strong> signal. GPC is a browser 
            setting that allows you to automatically opt out of data sales and certain tracking.
          </p>
          <p className="mt-2">
            To enable GPC:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Use a browser that supports GPC (e.g., Firefox, Brave, DuckDuckGo)</li>
            <li>Enable the GPC setting in your browser's privacy preferences</li>
            <li>The signal will be sent automatically to websites that support it</li>
          </ul>
          <p className="mt-3">
            <strong>Note:</strong> Since we do not sell personal data or use tracking cookies for advertising, 
            the GPC signal has minimal impact on your experience with ReadMyFinePrint. However, we respect and 
            honor this signal as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Changes to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time to reflect changes in our practices or legal 
            requirements. We will notify you of significant changes by:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Updating the "Last Updated" date at the top of this page</li>
            <li>Displaying an in-app notice for material changes</li>
          </ul>
          <p className="mt-2">
            We encourage you to review this policy periodically.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
          <p>
            If you have questions about our use of cookies or device fingerprints, please contact us:
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mt-3">
            <p><strong>Email:</strong> <a href="mailto:privacy@readmyfineprint.com" className="text-blue-600 dark:text-blue-300 hover:underline">privacy@readmyfineprint.com</a></p>
            <p><strong>Website:</strong> <a href="https://readmyfineprint.com" className="text-blue-600 dark:text-blue-300 hover:underline">https://readmyfineprint.com</a></p>
          </div>
        </section>

      </CardContent>
    </Card>
  );
}
