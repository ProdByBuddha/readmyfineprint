import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TermsOfService() {
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center">
          Terms of Service
        </CardTitle>
        <p className="text-center text-muted-foreground mt-2">
          Last Updated: October 1, 2025
        </p>
      </CardHeader>
      <CardContent className="prose dark:prose-invert max-w-none space-y-6">
        
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Agreement to Terms</h2>
          <p>
            By creating an account or using ReadMyFinePrint (the "Services"), you agree to these Terms of Service ("Terms"). 
            If you do not agree, you may not use the Services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. No Legal Advice</h2>
          <p>
            The Services provide automated document analysis for <strong>informational purposes only</strong>. 
            ReadMyFinePrint is not a law firm, does not offer legal advice, and no attorney–client relationship 
            is created by using the Services. You should consult qualified legal counsel before relying on any analysis 
            provided by the Services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Disclaimer of Warranties</h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 p-6 rounded-lg my-4">
            <p className="font-bold text-lg mb-2">CONSPICUOUS NOTICE:</p>
            <p className="uppercase font-semibold">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICES AND ALL OUTPUTS ARE PROVIDED "AS IS" AND 
              "AS AVAILABLE." WE DISCLAIM ALL WARRANTIES—EXPRESS, IMPLIED OR STATUTORY—INCLUDING IMPLIED WARRANTIES 
              OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON‑INFRINGEMENT, AND ACCURACY OF OUTPUTS.
            </p>
          </div>
          <p>
            We do not warrant that the Services will be uninterrupted, secure, or error-free, or that any defects 
            will be corrected. You use the Services at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Limitation of Liability</h2>
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 p-6 rounded-lg my-4">
            <p className="font-bold text-lg mb-2">CONSPICUOUS NOTICE:</p>
            <p className="uppercase font-semibold">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, READMYFINEPRINT, ITS AFFILIATES AND PROVIDERS ARE NOT LIABLE 
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES OR FOR ANY LOSS 
              OF PROFITS, BUSINESS, GOODWILL OR DATA. OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE 
              SERVICES WILL NOT EXCEED (A) THE AMOUNTS PAID BY YOU TO US IN THE 12 MONTHS BEFORE THE EVENT GIVING 
              RISE TO LIABILITY, OR (B) USD $100 IF YOU USE A FREE TIER.
            </p>
          </div>
          <p>
            <strong>Carve-outs:</strong> Nothing in this clause limits liability that cannot be limited by law, 
            including liability for fraud, willful misconduct or, where applicable, death or personal injury caused 
            by negligence.
          </p>
          <p className="mt-2">
            <strong>Payment Processing:</strong> Payment processing is handled by Stripe, Inc. Any issues with 
            payment processing, including failed transactions, billing disputes, or payment errors, are subject 
            to Stripe's terms and conditions. ReadMyFinePrint is not liable for payment processing issues.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. User Indemnity</h2>
          <p>
            You agree to indemnify, defend, and hold harmless ReadMyFinePrint and its affiliates, officers, 
            directors, employees, and agents from and against any third-party claims, liabilities, damages, 
            losses, and expenses (including reasonable attorneys' fees) arising out of:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Content you upload to the Services;</li>
            <li>Your misuse of the Services in violation of law or these Terms;</li>
            <li>Your violation of any third-party rights; or</li>
            <li>Your breach of these Terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">6. AI-Specific Acknowledgements</h2>
          <p>
            The Services employ advanced personally identifiable information (PII) detection and redaction technology. 
            However, <strong>detection may not be perfect</strong>:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              The enhanced PII detector returns redaction maps and can compute hashed matches of detected PII 
              for analytics purposes.
            </li>
            <li>
              The zero-PII analyzer may still produce warnings when residual PII risk remains after redaction.
            </li>
            <li>
              You acknowledge that you must independently review AI output and that PII may still be sent to 
              third-party model providers as redacted placeholders.
            </li>
            <li>
              You should not upload documents containing highly sensitive information if you cannot accept 
              the risk of potential exposure.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Third-Party Services</h2>
          <p>
            The Services integrate with third-party providers:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              <strong>Document Analysis:</strong> Performed by third-party AI model providers (e.g., OpenAI) 
              using redacted text. Third-party providers may retain API inputs and outputs for up to 30 days, 
              or longer under legal hold.
            </li>
            <li>
              <strong>Payment Processing:</strong> Handled by Stripe, Inc. We never store payment card numbers; 
              all payment data is processed securely by Stripe.
            </li>
            <li>
              <strong>Authentication & Security:</strong> TOTP (Time-based One-Time Password) secrets and backup 
              codes are encrypted and stored securely. TOTP events are logged with hashed IP addresses and 
              user-agent data for security auditing. Security questions (where still available) are hashed 
              using Argon2.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">8. User Responsibilities</h2>
          <p>You agree to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Provide accurate account information;</li>
            <li>Maintain the security of your account credentials;</li>
            <li>Not upload content that violates any law or third-party rights;</li>
            <li>Not attempt to circumvent security measures or rate limits;</li>
            <li>Not use the Services for any fraudulent or unlawful purpose;</li>
            <li>Not reverse engineer, decompile, or attempt to extract source code from the Services.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">9. Subscription Tiers & Billing</h2>
          <p>
            ReadMyFinePrint offers multiple subscription tiers with different features and rate limits. 
            Billing is handled monthly or annually as selected. Subscriptions automatically renew unless 
            cancelled before the renewal date. You may cancel at any time through your account settings.
          </p>
          <p className="mt-2">
            Failed payments may result in downgrade to a free tier. We will notify you of payment failures 
            and provide opportunities to update payment information before downgrading your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">10. Account Termination</h2>
          <p>
            We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, 
            or for any other reason at our discretion. You may delete your account at any time through your 
            account settings. Upon termination:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Your access to the Services will be revoked immediately;</li>
            <li>Document content in memory will be deleted when your session expires (30 minutes of inactivity);</li>
            <li>Usage logs and security logs will be retained as described in our Privacy Policy;</li>
            <li>No refunds will be provided for partial subscription periods.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">11. Modifications to Terms</h2>
          <p>
            We may update these Terms from time to time. <strong>Material changes</strong> (such as changes to 
            arbitration provisions, liability limitations, or pricing) will require your re-consent via 
            click-through acceptance. We will notify you of such changes by:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Email to your registered address; and/or</li>
            <li>Prominent in-app notice.</li>
          </ul>
          <p className="mt-2">
            <strong>Continued use alone does not constitute acceptance of material changes.</strong> For 
            non-material changes (such as clarifications or updates to reflect new features), we will update 
            the "Last Updated" date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">12. Governing Law & Dispute Resolution</h2>
          <p>
            These Terms are governed by the laws of the State of California, United States, excluding its 
            conflict of laws principles.
          </p>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Arbitration (U.S. Consumers)</h3>
          <p>
            Any dispute arising from these Terms or the Services shall be resolved through binding individual 
            arbitration in accordance with the American Arbitration Association's Consumer Arbitration Rules, 
            except:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>You may bring claims in small claims court if they qualify;</li>
            <li>Either party may seek injunctive relief in court for intellectual property violations.</li>
          </ul>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Class Action Waiver</h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-600 p-4 rounded-lg my-3">
            <p className="font-semibold">
              YOU AND READMYFINEPRINT AGREE THAT DISPUTES WILL BE RESOLVED ON AN INDIVIDUAL BASIS ONLY. 
              YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION, CLASS ARBITRATION, OR REPRESENTATIVE 
              ACTION.
            </p>
          </div>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Opt-Out</h3>
          <p>
            You may opt out of arbitration within 30 days of first accepting these Terms by sending written 
            notice to: legal@readmyfineprint.com with the subject line "Arbitration Opt-Out" and including 
            your name and email address.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">13. Miscellaneous</h2>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Entire Agreement</h3>
          <p>
            These Terms, together with our Privacy Policy and Cookie Policy, constitute the entire agreement 
            between you and ReadMyFinePrint regarding the Services.
          </p>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Severability</h3>
          <p>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will 
            remain in full force and effect.
          </p>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Assignment</h3>
          <p>
            You may not assign or transfer these Terms without our prior written consent. We may assign 
            these Terms in connection with a merger, acquisition, or sale of assets.
          </p>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">Waiver</h3>
          <p>
            Our failure to enforce any provision of these Terms does not constitute a waiver of that provision 
            or any other provision.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">14. Contact Information</h2>
          <p>
            If you have questions about these Terms, please contact us at:
          </p>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mt-3">
            <p>Email: <a href="mailto:legal@readmyfineprint.com" className="text-blue-600 dark:text-blue-400 hover:underline">legal@readmyfineprint.com</a></p>
            <p>Website: <a href="https://readmyfineprint.com" className="text-blue-600 dark:text-blue-400 hover:underline">https://readmyfineprint.com</a></p>
          </div>
        </section>

      </CardContent>
    </Card>
  );
}
