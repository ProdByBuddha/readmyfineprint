import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Shield, 
  CheckCircle, 
  FileText, 
  Lock, 
  Eye, 
  Zap,
  Award,
  Users,
  BookOpen,
  Scale,
  Home,
  Briefcase,
  ScrollText,
  FileCheck
} from "lucide-react";
import { usePreventFlicker } from "@/hooks/usePreventFlicker";
import TradeSecretProtection from "@/components/TradeSecretProtection";
import { MobileAppWrapper } from "@/components/MobileAppWrapper";
import { useCombinedConsent } from "@/components/CombinedConsent";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { generateFAQSchema, updateSEO } from "@/lib/seo";
import { Link } from "wouter";

export default function Home() {
  const { isAccepted: consentAccepted } = useCombinedConsent();
  const containerRef = usePreventFlicker();

  // Enhanced SEO structured data
  useEffect(() => {
    const faqData = [
      {
        question: "How secure is my document data?",
        answer: "Your documents are protected with military-grade encryption and privacy-preserving AI technology. We never store your documents permanently, and sensitive information is automatically detected and shielded during analysis."
      },
      {
        question: "What types of legal documents can I analyze?",
        answer: "Our AI analyzes contracts, terms of service, privacy policies, employment agreements, rental agreements, NDAs, purchase agreements, and most other legal documents in English."
      },
      {
        question: "How accurate are the AI analysis results?",
        answer: "Our proprietary privacy-preserving AI has been trained on thousands of legal documents and consistently identifies key clauses, risks, and opportunities with enterprise-grade accuracy."
      },
      {
        question: "Can I use this for business or enterprise needs?",
        answer: "Yes, our platform is designed for both individual and enterprise use with advanced security protocols, audit trails, and compliance features suitable for professional legal review."
      }
    ];

    updateSEO({
      title: "Privacy-First AI Legal Document Analysis | ReadMyFinePrint",
      description: "Analyze contracts, agreements, and legal documents with enterprise-grade AI while keeping your sensitive information completely secure. Privacy-preserving technology for legal professionals.",
      keywords: "legal document analysis, contract analysis, privacy-first AI, enterprise legal tech, document review, contract review",
      structuredData: generateFAQSchema(faqData)
    });
  }, []);

  const contractTypes = [
    {
      icon: Briefcase,
      title: "Employment Contracts",
      description: "Salary terms, benefits, non-compete clauses",
      color: "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
    },
    {
      icon: Home,
      title: "Rental Agreements",
      description: "Lease terms, deposit conditions, tenant rights",
      color: "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400"
    },
    {
      icon: ScrollText,
      title: "Terms of Service",
      description: "Privacy policies, user agreements, liability",
      color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400"
    },
    {
      icon: Scale,
      title: "Business Contracts",
      description: "Vendor agreements, partnerships, NDAs",
      color: "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400"
    },
    {
      icon: BookOpen,
      title: "Software Licenses",
      description: "Usage rights, restrictions, compliance",
      color: "bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400"
    },
    {
      icon: FileCheck,
      title: "Purchase Agreements",
      description: "Payment terms, warranties, returns",
      color: "bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400"
    }
  ];

  const features = [
    {
      icon: Shield,
      title: "Military-Grade Security",
      description: "Enterprise-level encryption and privacy-preserving AI technology protects your sensitive documents.",
      badge: "Enterprise Security"
    },
    {
      icon: Zap,
      title: "Instant Analysis",
      description: "Get comprehensive legal insights in seconds, not hours. AI-powered analysis delivered immediately.",
      badge: "Real-time Results"
    },
    {
      icon: Eye,
      title: "Privacy-First AI",
      description: "Advanced privacy technology ensures your sensitive information never leaves your control.",
      badge: "Zero Data Storage"
    },
    {
      icon: CheckCircle,
      title: "Plain English Summaries",
      description: "Complex legal language transformed into clear, actionable insights you can understand.",
      badge: "Human-Readable"
    }
  ];

  const trustIndicators = [
    "🔒 SOC 2 Compliant",
    "🛡️ End-to-End Encryption", 
    "⚖️ Legal Professional Grade",
    "🏆 Enterprise Trusted",
    "🔐 Zero Knowledge Architecture",
    "✅ GDPR Compliant"
  ];

  return (
    <div ref={containerRef} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 page-transition min-h-screen">
      <TradeSecretProtection />
      <MobileAppWrapper>
        {/* Cookie Consent Banner */}
        {!consentAccepted && (
          <CookieConsentBanner onAccept={() => {
            // The event listener in the hook will trigger the update
          }} />
        )}
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Hero Section */}
          <section 
            className="text-center mb-16 animate-fade-in-scale" 
            role="banner" 
            aria-labelledby="main-heading"
            data-testid="hero-section"
          >
            <div className="mb-6">
              <Badge 
                variant="outline" 
                className="mb-4 px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800"
                data-testid="hero-badge"
              >
                <Lock className="w-4 h-4 mr-2" />
                Enterprise-Grade Privacy Protection
              </Badge>
            </div>

            <h1 
              id="main-heading" 
              className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6 leading-tight"
              data-testid="main-heading"
            >
              Privacy-First AI<br />
              <span className="text-primary">Document Analysis</span>
            </h1>
            
            <p 
              className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed"
              data-testid="hero-description"
            >
              Analyze contracts, agreements, and legal documents with enterprise-grade AI 
              while keeping your <strong>sensitive information completely secure</strong>.
            </p>

            {/* Call to Action */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
              <Link to="/upload" data-testid="upload-button-link">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white px-10 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  data-testid="upload-button"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Analyze Document Securely
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/blog" data-testid="learn-more-link">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="px-10 py-4 text-lg font-medium border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
                  data-testid="learn-more-button"
                >
                  Learn More
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="mb-8 max-w-5xl mx-auto" data-testid="trust-indicators">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm text-gray-600 dark:text-gray-300">
                {trustIndicators.map((indicator, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-center gap-1 p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                    data-testid={`trust-indicator-${index}`}
                  >
                    <span className="text-xs font-medium">{indicator}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Notice */}
            <div 
              className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 max-w-3xl mx-auto" 
              role="alert" 
              aria-labelledby="privacy-notice"
              data-testid="privacy-notice"
            >
              <h3 id="privacy-notice" className="sr-only">Privacy Notice</h3>
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                    Zero Knowledge Architecture
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Your sensitive information is automatically detected and protected using 
                    advanced privacy technology. <strong>Documents are never stored</strong> — 
                    processed with complete confidentiality and deleted immediately after analysis.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Sample Analysis Section */}
          <section 
            className="mb-16" 
            aria-labelledby="sample-analysis-heading"
            data-testid="sample-analysis-section"
          >
            <div className="text-center mb-12">
              <h2 
                id="sample-analysis-heading" 
                className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4"
                data-testid="sample-analysis-heading"
              >
                Analyze Any Legal Document
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Our AI understands complex legal language across all document types. 
                Upload contracts, agreements, policies, and more for instant analysis.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="contract-types-grid">
              {contractTypes.map((type, index) => (
                <Card 
                  key={index}
                  className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-md"
                  data-testid={`contract-type-${index}`}
                >
                  <CardHeader className="pb-3">
                    <div className={`w-12 h-12 rounded-lg ${type.color} flex items-center justify-center mb-3`}>
                      <type.icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {type.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link to="/upload">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="px-8 py-3 text-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all duration-300"
                  data-testid="try-analysis-button"
                >
                  Try Document Analysis Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </section>

          {/* Features Section */}
          <section 
            className="mb-16" 
            aria-labelledby="features-heading"
            data-testid="features-section"
          >
            <div className="text-center mb-12">
              <h2 
                id="features-heading" 
                className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4"
                data-testid="features-heading"
              >
                Enterprise-Grade Document Analysis
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Advanced AI technology with uncompromising privacy protection for legal professionals and enterprises.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8" data-testid="features-grid">
              {features.map((feature, index) => (
                <Card 
                  key={index}
                  className="p-6 hover:shadow-xl transition-all duration-300 bg-white dark:bg-gray-800 border-0 shadow-lg"
                  data-testid={`feature-${index}`}
                >
                  <CardContent className="p-0">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-7 h-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {feature.title}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {feature.badge}
                          </Badge>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Enterprise Trust Section */}
          <section 
            className="mb-16 text-center"
            aria-labelledby="enterprise-heading"
            data-testid="enterprise-section"
          >
            <Card className="p-8 md:p-12 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-0 shadow-xl">
              <CardContent className="p-0">
                <div className="flex justify-center mb-6">
                  <div className="flex items-center gap-2">
                    <Award className="w-8 h-8 text-primary" />
                    <Users className="w-8 h-8 text-primary" />
                    <Shield className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h2 
                  id="enterprise-heading"
                  className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4"
                  data-testid="enterprise-heading"
                >
                  Trusted by Legal Professionals
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
                  Our privacy-preserving AI technology meets the highest standards for legal document analysis, 
                  with enterprise-grade security and compliance features trusted by professionals worldwide.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                  <div className="text-center" data-testid="stat-accuracy">
                    <div className="text-3xl font-bold text-primary mb-1">99.9%</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Accuracy Rate</div>
                  </div>
                  <div className="text-center" data-testid="stat-security">
                    <div className="text-3xl font-bold text-primary mb-1">256-bit</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Encryption</div>
                  </div>
                  <div className="text-center" data-testid="stat-compliance">
                    <div className="text-3xl font-bold text-primary mb-1">SOC 2</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Compliant</div>
                  </div>
                  <div className="text-center" data-testid="stat-storage">
                    <div className="text-3xl font-bold text-primary mb-1">Zero</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Data Storage</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* FAQ Section */}
          <section 
            aria-labelledby="faq-heading" 
            className="mb-16"
            data-testid="faq-section"
          >
            <Card className="p-8 md:p-12 bg-white dark:bg-gray-800 shadow-xl border-0">
              <CardContent className="p-0">
                <h2 
                  id="faq-heading" 
                  className="text-3xl md:text-4xl font-bold mb-10 text-center text-gray-900 dark:text-white"
                  data-testid="faq-heading"
                >
                  Frequently Asked Questions
                </h2>
                <div className="max-w-4xl mx-auto space-y-6">
                  <div 
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    data-testid="faq-item-0"
                  >
                    <h3 className="font-semibold mb-3 text-gray-900 dark:text-white text-lg">
                      How secure is my document data?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Your documents are protected with military-grade encryption and privacy-preserving AI technology. 
                      We never store your documents permanently, and sensitive information is automatically detected 
                      and shielded during analysis. Our zero-knowledge architecture ensures complete confidentiality.
                    </p>
                  </div>
                  <div 
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    data-testid="faq-item-1"
                  >
                    <h3 className="font-semibold mb-3 text-gray-900 dark:text-white text-lg">
                      What types of legal documents can I analyze?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Our AI analyzes contracts, terms of service, privacy policies, employment agreements, 
                      rental agreements, NDAs, purchase agreements, and most other legal documents in English. 
                      Upload PDFs, Word docs, or paste text directly for instant analysis.
                    </p>
                  </div>
                  <div 
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    data-testid="faq-item-2"
                  >
                    <h3 className="font-semibold mb-3 text-gray-900 dark:text-white text-lg">
                      How accurate are the AI analysis results?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Our proprietary privacy-preserving AI has been trained on thousands of legal documents 
                      and consistently identifies key clauses, risks, and opportunities with enterprise-grade accuracy. 
                      While highly accurate, we recommend consulting with a legal professional for critical decisions.
                    </p>
                  </div>
                  <div 
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    data-testid="faq-item-3"
                  >
                    <h3 className="font-semibold mb-3 text-gray-900 dark:text-white text-lg">
                      Can I use this for business or enterprise needs?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Yes, our platform is designed for both individual and enterprise use with advanced security protocols, 
                      audit trails, and compliance features suitable for professional legal review. We offer enterprise plans 
                      with additional security features and dedicated support.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Final CTA */}
          <section 
            className="text-center mb-12"
            data-testid="final-cta-section"
          >
            <Card className="p-8 md:p-12 bg-gradient-to-r from-primary/5 to-blue-500/5 dark:from-primary/10 dark:to-blue-500/10 border-0 shadow-lg">
              <CardContent className="p-0">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  Ready to Analyze Your Documents Securely?
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                  Join thousands of professionals who trust our privacy-first AI for their legal document analysis needs.
                </p>
                <Link to="/upload">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white px-12 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    data-testid="final-cta-button"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Start Secure Analysis Now
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </section>
        </div>
      </MobileAppWrapper>
    </div>
  );
}