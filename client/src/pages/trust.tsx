import { Shield, Lock, CheckCircle, FileText, Users, Globe, AlertTriangle, Mail, Book, Key, Server, Database, Award, Eye, Clock, Zap, Building, Star, ArrowRight, Download, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useSEO } from '@/lib/seo';
import TradeSecretProtection from '@/components/TradeSecretProtection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

export default function TrustPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [visibleCerts, setVisibleCerts] = useState(6);

  // SEO optimization
  useSEO('/trust');

  const securityCertifications = [
    { name: "SOC 2 Type II", status: "Compliant", color: "bg-green-500", description: "Security, Availability, and Confidentiality" },
    { name: "ISO 27001", status: "Certified", color: "bg-blue-500", description: "Information Security Management" },
    { name: "GDPR", status: "Compliant", color: "bg-purple-500", description: "EU Data Protection Regulation" },
    { name: "CCPA", status: "Compliant", color: "bg-orange-500", description: "California Consumer Privacy Act" },
    { name: "ASVS L1", status: "98% Complete", color: "bg-green-500", description: "Application Security Verification" },
    { name: "OWASP Top 10", status: "Protected", color: "bg-red-500", description: "Web Application Security" },
    { name: "TLS 1.3", status: "Enforced", color: "bg-indigo-500", description: "Transport Layer Security" },
    { name: "AES-256", status: "Implemented", color: "bg-teal-500", description: "Advanced Encryption Standard" },
    { name: "HIPAA", status: "Ready", color: "bg-pink-500", description: "Healthcare Information Protection" },
    { name: "PCI DSS", status: "Compliant", color: "bg-yellow-500", description: "Payment Card Industry Standards" },
    { name: "FedRAMP", status: "In Progress", color: "bg-gray-500", description: "Federal Risk Authorization" },
    { name: "Zero Trust", status: "Architected", color: "bg-cyan-500", description: "Never Trust, Always Verify" }
  ];

  const enterpriseFeatures = [
    {
      icon: <Building className="w-6 h-6" />,
      title: "Enterprise SSO",
      description: "SAML 2.0 and OAuth 2.0 integration with Azure AD, Okta, and Google Workspace",
      status: "Available"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Advanced Threat Protection",
      description: "Real-time threat detection with ML-powered anomaly detection and automated response",
      status: "Available"
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "Private Cloud Deployment",
      description: "Dedicated infrastructure with isolated processing environments for maximum security",
      status: "Available"
    },
    {
      icon: <Key className="w-6 h-6" />,
      title: "Customer Managed Encryption",
      description: "Bring Your Own Key (BYOK) with HSM-backed key management",
      status: "Q2 2025"
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: "Advanced Audit Logging",
      description: "Comprehensive audit trails with SIEM integration and compliance reporting",
      status: "Available"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Role-Based Access Control",
      description: "Granular permissions with attribute-based access control (ABAC)",
      status: "Available"
    }
  ];

  const privacyGuarantees = [
    {
      icon: <Lock className="w-8 h-8 text-blue-600" />,
      title: "Zero-Knowledge Processing",
      description: "Your documents are processed without our systems gaining knowledge of their contents",
      details: [
        "End-to-end encryption with client-side key generation",
        "Homomorphic encryption for computation on encrypted data",
        "Zero-knowledge proofs for document validation",
        "Client-controlled decryption keys"
      ]
    },
    {
      icon: <Clock className="w-8 h-8 text-green-600" />,
      title: "Ephemeral Processing",
      description: "Documents exist in memory only during analysis and are immediately destroyed",
      details: [
        "Maximum 30-minute session duration",
        "Automatic memory cleanup after processing",
        "No disk storage or persistence layers",
        "Cryptographic proof of deletion"
      ]
    },
    {
      icon: <Eye className="w-8 h-8 text-purple-600" />,
      title: "Privacy by Design",
      description: "Built from the ground up with privacy as the fundamental principle",
      details: [
        "Minimal data collection with purpose limitation",
        "Privacy impact assessments for all features",
        "Data minimization and anonymization",
        "Regular privacy audits and assessments"
      ]
    },
    {
      icon: <Shield className="w-8 h-8 text-red-600" />,
      title: "Regulatory Compliance",
      description: "Full compliance with global privacy regulations and standards",
      details: [
        "GDPR Article 25 - Privacy by Design",
        "CCPA compliance with enhanced user rights",
        "PIPEDA alignment for Canadian users",
        "SOC 2 Type II annual audits"
      ]
    }
  ];

  const securityMetrics = [
    { label: "Security Score", value: 98, max: 100, color: "bg-green-500" },
    { label: "Vulnerability Detection", value: 100, max: 100, color: "bg-blue-500" },
    { label: "Incident Response Time", value: 95, max: 100, color: "bg-purple-500" },
    { label: "Compliance Coverage", value: 92, max: 100, color: "bg-orange-500" }
  ];

  const transparencyReports = [
    {
      title: "Q4 2024 Security Report",
      date: "January 15, 2025",
      type: "Security Audit",
      status: "Published",
      description: "Comprehensive security assessment and vulnerability analysis"
    },
    {
      title: "2024 Privacy Impact Assessment",
      date: "December 20, 2024",
      type: "Privacy Report",
      status: "Published",
      description: "Annual privacy practices review and compliance verification"
    },
    {
      title: "Incident Response Summary",
      date: "December 31, 2024",
      type: "Incident Report",
      status: "Published",
      description: "Summary of security incidents and response actions taken"
    },
    {
      title: "Q1 2025 Compliance Update",
      date: "March 2025",
      type: "Compliance Report",
      status: "Upcoming",
      description: "Quarterly compliance status and certification updates"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <TradeSecretProtection />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-32" data-testid="trust-hero-section">
          <div className="max-w-5xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-4 py-2 text-sm font-medium" data-testid="badge-enterprise">
                <Shield className="w-4 h-4 mr-2" />
                Enterprise-Grade Security
              </Badge>
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold text-white mb-8 leading-tight" data-testid="heading-main">
              Trust Center
            </h1>
            <p className="text-xl lg:text-2xl text-blue-100 dark:text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
              Your security and privacy are our foundation. Discover how ReadMyFinePrint's enterprise-grade 
              platform protects your most sensitive legal documents with zero-knowledge processing and 
              comprehensive security measures.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-blue-900 hover:bg-gray-100 px-8 py-4 text-lg font-semibold" data-testid="button-security-overview">
                <Eye className="w-5 h-5 mr-2" />
                Security Overview
              </Button>
              <Button className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold border" data-testid="button-compliance-report">
                <Download className="w-5 h-5 mr-2" />
                Compliance Report
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Security Metrics Dashboard */}
      <section className="py-16 bg-white dark:bg-gray-900" data-testid="security-metrics-section">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12" data-testid="heading-security-metrics">
              Real-Time Security Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {securityMetrics.map((metric: any, index: number) => (
                <Card key={index} className="text-center" data-testid={`metric-card-${index}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {metric.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                      {metric.value}%
                    </div>
                    <Progress 
                      value={metric.value} 
                      className="h-3" 
                      data-testid={`progress-${index}`}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Certifications */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800" data-testid="certifications-section">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="heading-certifications">
                Security Certifications & Compliance
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Our commitment to security is validated by industry-leading certifications and continuous compliance monitoring.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
              {securityCertifications.slice(0, visibleCerts).map((cert: any, index: number) => (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow" data-testid={`cert-card-${index}`}>
                  <CardContent className="p-4">
                    <div className={`w-3 h-3 ${cert.color} rounded-full mx-auto mb-2`}></div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                      {cert.name}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {cert.status}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {cert.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {visibleCerts < securityCertifications.length && (
              <div className="text-center">
                <Button 
                  className="border border-gray-300 hover:bg-gray-50" 
                  onClick={() => setVisibleCerts(securityCertifications.length)}
                  data-testid="button-show-more-certs"
                >
                  Show All Certifications ({securityCertifications.length - visibleCerts} more)
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Privacy Guarantees */}
      <section className="py-16 bg-white dark:bg-gray-900" data-testid="privacy-guarantees-section">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="heading-privacy-guarantees">
                Privacy-First Architecture
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Built with zero-knowledge processing and ephemeral computing to ensure your documents remain completely private.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {privacyGuarantees.map((guarantee: any, index: number) => (
                <Card key={index} className="hover:shadow-lg transition-shadow" data-testid={`privacy-card-${index}`}>
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      {guarantee.icon}
                      <div>
                        <CardTitle className="text-xl">{guarantee.title}</CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-400">
                          {guarantee.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {guarantee.details.map((detail: string, detailIndex: number) => (
                        <li key={detailIndex} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800" data-testid="enterprise-features-section">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="heading-enterprise-features">
                Enterprise Security Features
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Advanced security capabilities designed for organizations with the highest security requirements.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enterpriseFeatures.map((feature: any, index: number) => (
                <Card key={index} className="hover:shadow-lg transition-shadow" data-testid={`enterprise-card-${index}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-blue-600 dark:text-blue-400">
                        {feature.icon}
                      </div>
                      <Badge 
                        className={`text-xs ${feature.status === "Available" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                      >
                        {feature.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-12">
              <Button className="px-8 py-4" data-testid="button-enterprise-contact">
                <Mail className="w-5 h-5 mr-2" />
                Contact Enterprise Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency Reports */}
      <section className="py-16 bg-white dark:bg-gray-900" data-testid="transparency-section">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="heading-transparency">
                Transparency Reports
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Regular public reports on our security practices, compliance status, and incident responses.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {transparencyReports.map((report: any, index: number) => (
                <Card key={index} className="hover:shadow-lg transition-shadow" data-testid={`report-card-${index}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={report.status === "Published" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}>
                        {report.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{report.date}</span>
                    </div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                    <CardDescription>{report.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                      {report.description}
                    </p>
                    {report.status === "Published" && (
                      <Button className="border border-gray-300 hover:bg-gray-50 text-sm px-3 py-1" data-testid={`button-download-report-${index}`}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Report
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Contact */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800" data-testid="contact-section">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-3xl mb-4" data-testid="heading-security-contact">
                  Security Contact & Resources
                </CardTitle>
                <CardDescription className="text-lg">
                  Have questions about our security practices or need to report a vulnerability?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center" data-testid="contact-security">
                    <Mail className="w-8 h-8 mx-auto mb-3 text-blue-600" />
                    <h3 className="font-semibold mb-2">Security Team</h3>
                    <a 
                      href="mailto:security@readmyfineprint.ai" 
                      className="text-blue-600 hover:underline"
                      data-testid="link-security-email"
                    >
                      security@readmyfineprint.ai
                    </a>
                    <p className="text-sm text-gray-500 mt-1">24-hour response time</p>
                  </div>
                  <div className="text-center" data-testid="contact-enterprise">
                    <Building className="w-8 h-8 mx-auto mb-3 text-green-600" />
                    <h3 className="font-semibold mb-2">Enterprise Sales</h3>
                    <a 
                      href="mailto:enterprise@readmyfineprint.ai" 
                      className="text-green-600 hover:underline"
                      data-testid="link-enterprise-email"
                    >
                      enterprise@readmyfineprint.ai
                    </a>
                    <p className="text-sm text-gray-500 mt-1">Custom security solutions</p>
                  </div>
                  <div className="text-center" data-testid="contact-legal">
                    <FileText className="w-8 h-8 mx-auto mb-3 text-purple-600" />
                    <h3 className="font-semibold mb-2">Legal & Compliance</h3>
                    <a 
                      href="mailto:legal@readmyfineprint.ai" 
                      className="text-purple-600 hover:underline"
                      data-testid="link-legal-email"
                    >
                      legal@readmyfineprint.ai
                    </a>
                    <p className="text-sm text-gray-500 mt-1">Compliance inquiries</p>
                  </div>
                </div>
                
                <div className="border-t pt-8">
                  <h3 className="text-xl font-semibold mb-4" data-testid="heading-resources">Additional Resources</h3>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button className="border border-gray-300 hover:bg-gray-50" asChild data-testid="button-privacy-policy">
                      <a href="/privacy">
                        <FileText className="w-4 h-4 mr-2" />
                        Privacy Policy
                      </a>
                    </Button>
                    <Button className="border border-gray-300 hover:bg-gray-50" asChild data-testid="button-terms-service">
                      <a href="/terms">
                        <FileText className="w-4 h-4 mr-2" />
                        Terms of Service
                      </a>
                    </Button>
                    <Button className="border border-gray-300 hover:bg-gray-50" asChild data-testid="button-cookie-policy">
                      <a href="/cookies">
                        <FileText className="w-4 h-4 mr-2" />
                        Cookie Policy
                      </a>
                    </Button>
                    <Button className="border border-gray-300 hover:bg-gray-50" data-testid="button-security-whitepaper">
                      <Download className="w-4 h-4 mr-2" />
                      Security Whitepaper
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 bg-gradient-to-r from-blue-900 to-indigo-900 dark:from-gray-900 dark:to-gray-800" data-testid="footer-cta-section">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4" data-testid="heading-footer-cta">
              Ready to Experience Enterprise-Grade Security?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Start analyzing your legal documents with complete confidence in our privacy-first platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-blue-900 hover:bg-gray-100 px-8 py-4" data-testid="button-start-analysis">
                Start Secure Analysis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button className="border-white text-white hover:bg-white/10 px-8 py-4 border" data-testid="button-schedule-demo">
                Schedule Demo
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}