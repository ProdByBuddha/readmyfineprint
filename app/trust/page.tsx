'use client';

'use client';

import { Shield, Lock, CheckCircle, FileText, Users, Globe, AlertTriangle, Mail, Book, Key, Server, Database } from "lucide-react";
import { useState } from "react";

export default function TrustPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const sections = [
    {
      id: "privacy",
      title: "Privacy Policy & Data Handling",
      icon: <Shield className="h-6 w-6 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <p>At ReadMyFinePrint, your privacy is paramount. We are committed to protecting your personal information and ensuring transparency in our data handling practices.</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>No Permanent Storage:</strong> We do not permanently store any documents you upload for analysis. All uploaded content is processed in-memory and deleted immediately after analysis is complete or your session ends.</li>
            <li><strong>Data Minimization:</strong> We only collect data absolutely necessary for providing our service, such as session information and anonymized usage statistics to improve our platform.</li>
            <li><strong>No Third-Party Sharing:</strong> Your data is never sold, rented, or shared with third parties for marketing or any other purposes.</li>
            <li><strong>GDPR & CCPA Compliance:</strong> We adhere to global data protection regulations, including GDPR and CCPA, giving you full control over your data.</li>
          </ul>
          <p>For complete details, please review our comprehensive <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.</p>
        </div>
      ),
    },
    {
      id: "security",
      title: "Security Measures",
      icon: <Lock className="h-6 w-6 text-green-500" />,
      content: (
        <div className="space-y-4">
          <p>We employ robust security measures to protect our infrastructure and your interactions with ReadMyFinePrint.</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>End-to-End Encryption:</strong> All data transmitted between your device and our servers is encrypted using industry-standard TLS/SSL protocols.</li>
            <li><strong>Secure Infrastructure:</strong> Our services are hosted on secure, regularly audited cloud infrastructure with advanced threat detection and prevention systems.</li>
            <li><strong>Access Control:</strong> Strict access controls are in place to ensure only authorized personnel can access sensitive systems, and all access is logged and monitored.</li>
            <li><strong>Regular Audits & Penetration Testing:</strong> We conduct regular security audits and engage in third-party penetration testing to identify and remediate potential vulnerabilities.</li>
          </ul>
          <p>Our commitment to security is unwavering. We continuously update our practices to counter evolving threats.</p>
        </div>
      ),
    },
    {
      id: "transparency",
      title: "Transparency & Accountability",
      icon: <FileText className="h-6 w-6 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <p>Transparency is a core value at ReadMyFinePrint. We believe you have a right to know how our service operates and how your data is handled.</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Clear Terms of Service:</strong> Our Terms of Service are written in clear, understandable language, avoiding legal jargon where possible.</li>
            <li><strong>Open Communication:</strong> We are committed to open communication regarding any security incidents or changes to our policies.</li>
            <li><strong>User Control:</strong> You have full control over your account and data, including the ability to delete your account and associated information at any time.</li>
            <li><strong>Independent Audits:</strong> We welcome and encourage independent security researchers to review our practices (within our responsible disclosure program guidelines).</li>
          </ul>
          <p>We strive to be a trustworthy partner in your legal document understanding journey.</p>
        </div>
      ),
    },
    {
      id: "compliance",
      title: "Legal & Regulatory Compliance",
      icon: <Users className="h-6 w-6 text-orange-500" />,
      content: (
        <div className="space-y-4">
          <p>ReadMyFinePrint operates in full compliance with relevant legal and regulatory frameworks.</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Jurisdiction:</strong> We operate under the laws of [Your Jurisdiction, e.g., Delaware, USA].</li>
            <li><strong>Industry Standards:</strong> We adhere to industry best practices for data security and privacy.</li>
            <li><strong>Legal Professional Verification:</strong> For certain advanced features, we may implement verification processes for legal professionals to ensure responsible use.</li>
            <li><strong>Law Enforcement Requests:</strong> We have a strict policy for handling law enforcement requests, ensuring due process and user rights are protected.</li>
          </ul>
          <p>Our legal team continuously monitors the regulatory landscape to ensure ongoing compliance.</p>
        </div>
      ),
    },
    {
      id: "ai-ethics",
      title: "AI Ethics & Responsible Use",
      icon: <Globe className="h-6 w-6 text-red-500" />,
      content: (
        <div className="space-y-4">
          <p>We are committed to the ethical and responsible development and deployment of AI technologies.</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Bias Mitigation:</strong> We actively work to identify and mitigate biases in our AI models to ensure fair and accurate analysis for all users.</li>
            <li><strong>Transparency in AI:</strong> While our AI models are complex, we strive to provide clear explanations of their capabilities and limitations.</li>
            <li><strong>Human Oversight:</strong> AI analysis is a tool to assist, not replace, human judgment. We emphasize the importance of human review for critical legal decisions.</li>
            <li><strong>Continuous Improvement:</strong> We are dedicated to ongoing research and development in AI ethics to ensure our technology serves humanity responsibly.</li>
          </ul>
          <p>Our goal is to empower users with AI, not to replace the nuanced expertise of legal professionals.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen page-transition">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Our Commitment to Trust & Security
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Building a secure and trustworthy platform for your legal document analysis.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="border rounded-lg shadow-sm dark:border-gray-700">
              <button
                className="flex items-center justify-between w-full p-6 text-lg font-semibold text-left text-gray-900 dark:text-gray-100 focus:outline-none"
                onClick={() => toggleSection(section.id)}
              >
                <span className="flex items-center gap-3">
                  {section.icon}
                  {section.title}
                </span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${activeSection === section.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              {activeSection === section.id && (
                <div className="px-6 pb-6 text-gray-700 dark:text-gray-300">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-600 dark:text-gray-400">
          <p>Have more questions? Contact our support team at <a href="mailto:support@readmyfineprint.com" className="text-blue-600 hover:underline">support@readmyfineprint.com</a></p>
        </div>
      </div>
    </div>
  );
}
