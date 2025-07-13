import { Shield, Lock, CheckCircle, FileText, Users, Globe, AlertTriangle, Mail, Book, Key, Server, Database } from "lucide-react";
import { useState } from "react";

export default function TrustPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  
  const sections = [
    {
      id: 'security',
      title: 'Security Practices',
      icon: <Shield className="w-5 h-5" />,
      content: [
        {
          subtitle: 'Infrastructure Security',
          items: [
            'TLS 1.3 for all data in transit',
            'PostgreSQL database with connection encryption',
            'Session-based storage with automatic cleanup',
            'Rate limiting with IP-based throttling',
            'Comprehensive security headers (CSP, HSTS, XSS protection)'
          ]
        },
        {
          subtitle: 'Application Security',
          items: [
            'OWASP Top 10 vulnerability protection',
            'Content Security Policy (CSP) headers',
            'Cross-Site Request Forgery (CSRF) protection',
            'SQL injection prevention via parameterized queries',
            'XSS protection through input sanitization'
          ]
        },
        {
          subtitle: 'Authentication & Access Control',
          items: [
            'Multi-factor authentication (TOTP) available',
            'Argon2 password hashing with salt',
            'JWT tokens with versioned secrets',
            'Session-based document access control',
            'Admin-only access controls and verification'
          ]
        }
      ]
    },
    {
      id: 'privacy',
      title: 'Data Privacy',
      icon: <Lock className="w-5 h-5" />,
      content: [
        {
          subtitle: 'Data Collection & Usage',
          items: [
            'Minimal data collection principle',
            'No persistent storage of uploaded documents',
            'Session-based temporary document processing',
            'Automatic data deletion after processing',
            'No third-party data sharing'
          ]
        },
        {
          subtitle: 'User Rights',
          items: [
            'Right to access personal data',
            'Right to delete account and all data',
            'Right to data portability',
            'Right to opt-out of analytics',
            'Transparent privacy policy'
          ]
        },
        {
          subtitle: 'PII Protection',
          items: [
            'PII detection with pattern matching',
            'Automatic PII hashing with Argon2',
            'Security logs with hashed IP addresses',
            'Pseudonymized email addresses for privacy',
            'Audit trails without sensitive data exposure'
          ]
        }
      ]
    },
    {
      id: 'compliance',
      title: 'Compliance & Certifications',
      icon: <FileText className="w-5 h-5" />,
      content: [
        {
          subtitle: 'Regulatory Compliance',
          items: [
            'GDPR (General Data Protection Regulation)',
            'CCPA (California Consumer Privacy Act)',
            'PIPEDA (Canadian Privacy Law)',
            'LGPD (Brazilian Data Protection Law)',
            'Data Protection Act 2018 (UK)'
          ]
        },
        {
          subtitle: 'Security Standards',
          items: [
            'OWASP Top 10 protection measures',
            'Security best practices implementation',
            'Regular security audits and monitoring',
            'Vulnerability scanning and assessment',
            'Secure coding practices'
          ]
        },
        {
          subtitle: 'Accessibility Standards',
          items: [
            'WCAG 2.1 AA compliance',
            'Section 508 compliance',
            'ADA compliance for web accessibility',
            'ARIA best practices',
            'Keyboard navigation support'
          ]
        }
      ]
    },
    {
      id: 'incident',
      title: 'Incident Response',
      icon: <AlertTriangle className="w-5 h-5" />,
      content: [
        {
          subtitle: 'Monitoring & Detection',
          items: [
            'Security event logging and monitoring',
            'Rate limiting with automatic blocking',
            'Suspicious activity detection',
            'Failed authentication tracking',
            'Comprehensive audit trail'
          ]
        },
        {
          subtitle: 'Response Procedures',
          items: [
            'Prompt incident response protocols',
            'Automated security blocking measures',
            'User notification procedures',
            'Security incident investigation',
            'Post-incident security improvements'
          ]
        },
        {
          subtitle: 'Business Continuity',
          items: [
            'Database backup and recovery',
            'Error handling and recovery procedures',
            'Circuit breaker patterns for resilience',
            'Graceful degradation of services',
            'High availability design patterns'
          ]
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              ReadMyFinePrint Trust Center
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Your trust is our foundation. Learn about our security practices, data privacy measures, 
              and compliance standards that protect your legal documents.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="max-w-6xl mx-auto">
          {/* Security Badges - Actual Implementation Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">✓</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Security Headers</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">Argon2</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Password Hashing</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">TLS 1.3</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">In Transit</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">JWT</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Auth Tokens</div>
            </div>
          </div>

          {/* Main Sections */}
          <div className="space-y-8">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <button
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-blue-600 dark:text-blue-400">
                      {section.icon}
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {section.title}
                    </h2>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      activeSection === section.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {activeSection === section.id && (
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-6">
                      {section.content.map((subsection, idx) => (
                        <div key={idx}>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                            {subsection.subtitle}
                          </h3>
                          <ul className="space-y-2">
                            {subsection.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                  {item}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Additional Resources */}
          <div className="mt-12 bg-gray-50 dark:bg-gray-800 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Book className="w-6 h-6 text-blue-600" />
              Resources & Contact
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Documentation</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="/privacy" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="/terms" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="/cookies" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Cookie Policy
                    </a>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Security Contact</h3>
                <div className="space-y-3">
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    For security concerns or vulnerability reports:
                  </p>
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Mail className="w-4 h-4" />
                    <a href="mailto:security@readmyfineprint.com">security@readmyfineprint.com</a>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    We aim to respond to all security inquiries within 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Security Implementation Status */}
          <div className="mt-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Security Implementation Status</h3>
            <div className="flex flex-wrap justify-center gap-3">
              <img
                src="https://img.shields.io/badge/Security%20Headers-Implemented-brightgreen?style=for-the-badge"
                alt="Security Headers"
                className="h-8"
              />
              <img
                src="https://img.shields.io/badge/Authentication-Argon2-brightgreen?style=for-the-badge"
                alt="Argon2 Authentication"
                className="h-8"
              />
              <img
                src="https://img.shields.io/badge/Privacy-GDPR%20Compliant-blue?style=for-the-badge"
                alt="GDPR Compliant"
                className="h-8"
              />
              <img
                src="https://img.shields.io/badge/Encryption-TLS%201.3-blue?style=for-the-badge"
                alt="TLS 1.3 Encryption"
                className="h-8"
              />
              <img
                src="https://img.shields.io/badge/License-Proprietary-orange?style=for-the-badge"
                alt="Proprietary License"
                className="h-8"
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}