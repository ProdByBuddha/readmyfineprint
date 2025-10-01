import { useState, useEffect, useCallback, type MouseEvent } from "react";
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
  House,
  Briefcase,
  ScrollText,
  FileCheck,
  Star,
  Globe,
  Target,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Building,
} from "lucide-react";
import { usePreventFlicker } from "@/hooks/usePreventFlicker";
// Temporarily disabled TradeSecretProtection due to interference with app functionality
// import TradeSecretProtection from "@/components/TradeSecretProtection";
import { MobileAppWrapper } from "@/components/MobileAppWrapper";
import { useCombinedConsent } from "@/components/CombinedConsent";
import { generateFAQSchema, updateSEO } from "@/lib/seo";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { safeDispatchEvent } from "@/lib/safeDispatchEvent";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";

export default function Home() {
  const { isAccepted: consentAccepted, isCheckingConsent } = useCombinedConsent();
  const containerRef = usePreventFlicker();
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const { toast } = useToast();

  const handleStartAnalysisClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      // Prevent navigation if consent check is still in progress
      if (isCheckingConsent) {
        event.preventDefault();
        toast({
          title: "Please wait",
          description: "Verifying your consent status...",
        });
        return;
      }

      if (!consentAccepted) {
        event.preventDefault();
        toast({
          title: "Consent required",
          description:
            "Accept our cookie and privacy terms using the banner below to unlock document analysis.",
          variant: "destructive",
        });

        safeDispatchEvent("consentRequired", {
          detail: { 
            reason: "Document analysis requires consent",
            destination: "/upload" // Tell the modal where to redirect after acceptance
          },
        });
      }
    },
    [consentAccepted, isCheckingConsent, toast]
  );

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Enhanced SEO structured data
  useEffect(() => {
    const faqData = [
      {
        question: "How secure is my document data?",
        answer:
          "Your documents are protected with strong encryption and privacy-preserving AI technology. We never store your documents permanently, and sensitive information is automatically detected and shielded during analysis.",
      },
      {
        question: "What types of legal documents can I analyze?",
        answer:
          "Our AI analyzes contracts, terms of service, privacy policies, employment agreements, rental agreements, NDAs, purchase agreements, and most other legal documents in English.",
      },
      {
        question: "How accurate are the AI analysis results?",
        answer:
          "Our privacy-preserving AI has been trained on thousands of legal documents and consistently identifies key clauses, risks, and opportunities with high-quality analysis.",
      },
      {
        question: "Can I use this for business needs?",
        answer:
          "Yes, our platform is designed for both individual and business use with advanced security protocols, audit trails, and compliance features suitable for professional legal review.",
      },
    ];

    updateSEO({
      title: "AI Legal Document Analysis | ReadMyFinePrint",
      description:
        "Transform contract review with AI-powered legal document analysis. Strong security, instant insights, and privacy protection for legal professionals worldwide.",
      keywords:
        "AI legal document analysis, contract review, legal tech platform, document analysis AI, contract intelligence, legal automation",
      structuredData: generateFAQSchema(faqData),
    });
  }, []);

  const contractTypes = [
    {
      icon: Briefcase,
      title: "Employment Contracts",
      description:
        "Comprehensive analysis of compensation, benefits, non-compete clauses, and termination terms with risk assessment",
      gradient:
        "from-blue-500/20 to-indigo-600/20 dark:from-blue-400/10 dark:to-indigo-500/10",
      iconColor: "text-blue-600 dark:text-blue-300",
    },
    {
      icon: Scale,
      title: "Business Contracts",
      description:
        "In-depth review of vendor agreements, partnerships, NDAs, and liability provisions for business protection",
      gradient:
        "from-emerald-500/20 to-teal-600/20 dark:from-emerald-400/10 dark:to-teal-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: House,
      title: "Real Estate Agreements",
      description:
        "Detailed analysis of lease terms, purchase agreements, and property obligations with compliance checking",
      gradient:
        "from-orange-500/20 to-amber-600/20 dark:from-orange-400/10 dark:to-amber-500/10",
      iconColor: "text-orange-600 dark:text-orange-400",
    },
    {
      icon: ScrollText,
      title: "Privacy & Terms",
      description:
        "Smart parsing of privacy policies, terms of service, and data handling clauses with GDPR compliance",
      gradient:
        "from-purple-500/20 to-pink-600/20 dark:from-purple-400/10 dark:to-pink-500/10",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      icon: FileCheck,
      title: "Commercial Agreements",
      description:
        "Expert evaluation of purchase terms, warranties, returns, and commercial obligations with risk scoring",
      gradient:
        "from-cyan-500/20 to-blue-600/20 dark:from-cyan-400/10 dark:to-blue-500/10",
      iconColor: "text-cyan-600 dark:text-cyan-400",
    },
    {
      icon: BookOpen,
      title: "Intellectual Property",
      description:
        "Thorough review of software licenses, IP agreements, and usage restrictions with compliance validation",
      gradient:
        "from-rose-500/20 to-pink-600/20 dark:from-rose-400/10 dark:to-pink-500/10",
      iconColor: "text-rose-600 dark:text-rose-400",
    },
  ];

  // Testimonials will be added as we collect real user feedback
  const testimonials: any[] = [];

  return (
    <div
      ref={containerRef}
      className={`relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 page-transition overflow-hidden transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"
        }`}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

      {/* Temporarily disabled TradeSecretProtection due to interference with app functionality */}
      {/* <TradeSecretProtection /> */}
      <MobileAppWrapper>
          {/* Cookie Consent Banner - only show when not checking and not accepted */}
        {!isCheckingConsent && !consentAccepted && (
          <CookieConsentBanner
            onAccept={() => {
              // Wait for consent state to update before any navigation
              // The consentChanged event will trigger the useCombinedConsent hook to re-check
            }}
          />
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          {/* Hero Section */}
          <section
            className="text-center mb-20 animate-fade-in-scale"
            role="banner"
            aria-labelledby="main-heading"
            data-testid="hero-section"
          >
            <h1
              id="main-heading"
              className="text-5xl md:text-6xl lg:text-7xl font-black mb-8 leading-[0.9] tracking-tight"
              data-testid="main-heading"
            >
              <span className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 dark:from-white dark:via-blue-100 dark:to-white bg-clip-text text-transparent">
                Professional AI for
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-blue-600 to-secondary bg-clip-text text-transparent">
                Legal Intelligence
              </span>
            </h1>

            <p
              className="text-xl md:text-2xl lg:text-3xl text-slate-700 dark:text-slate-300 mb-10 max-w-5xl mx-auto leading-relaxed font-light"
              data-testid="hero-description"
            >
              Transform contract review with{" "}
              <span className="font-semibold text-primary">
                AI-powered analysis
              </span>{" "}
              that delivers{" "}
              <span className="font-semibold text-primary">
                instant insights
              </span>{" "}
              while maintaining{" "}
              <span className="font-semibold text-secondary">
                absolute privacy protection
              </span>{" "}
              for your sensitive documents.
            </p>

            {/* Call to Action */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
              <Link
                to="/upload"
                data-testid="upload-button-link"
                onClick={handleStartAnalysisClick}
                aria-disabled={!consentAccepted}
              >
                <Button
                  className="group bg-gradient-to-r from-primary via-blue-600 to-primary hover:from-primary/90 hover:via-blue-600/90 hover:to-primary/90 text-white px-12 py-5 text-xl font-bold shadow-2xl hover:shadow-primary/25 transition-all duration-500 transform hover:-translate-y-1 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="upload-button"
                  disabled={!consentAccepted || isCheckingConsent}
                >
                  <Shield className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform duration-300" />
                  {isCheckingConsent ? "Verifying..." : "Start Free Analysis"}
                  <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </Link>
              {!consentAccepted && !isCheckingConsent && (
                <p className="text-sm text-amber-700 dark:text-amber-300" role="alert">
                  Accept cookies and terms to enable document analysis features.
                </p>
              )}
            </div>
          </section>

          {/* Sample Analysis Section */}
          <section
            className="mb-24"
            aria-labelledby="sample-analysis-heading"
            data-testid="sample-analysis-section"
          >
            <div className="text-center mb-16">
              <h2
                id="sample-analysis-heading"
                className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight"
                data-testid="sample-analysis-heading"
              >
                AI That Understands
                <br />
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Legal Complexity
                </span>
              </h2>
              <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed font-light">
                Advanced natural language processing that delivers
                <strong className="font-semibold">
                  {" "}
                  professional analysis
                </strong>{" "}
                across all contract types.
              </p>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              data-testid="contract-types-grid"
            >
              {(contractTypes as any[]).map((type: any, index: number) => (
                <Card
                  key={index}
                  className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-0 shadow-xl hover:shadow-primary/10"
                  data-testid={`contract-type-${index}`}
                >
                  <CardHeader className="pb-4">
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <type.icon className={`w-8 h-8 ${type.iconColor}`} />
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      {type.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-16">
              <Link to="/upload" className="inline-block w-full max-w-md mx-auto">
                <Button
                  className="group bg-gradient-to-r from-secondary via-teal-600 to-secondary hover:from-secondary/90 hover:via-teal-600/90 hover:to-secondary/90 text-white px-6 sm:px-12 py-4 sm:py-4 text-base sm:text-xl font-bold shadow-2xl hover:shadow-secondary/25 transition-all duration-500 transform hover:-translate-y-1 w-full h-auto min-h-[3.5rem] flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap"
                  data-testid="try-analysis-button"
                >
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform duration-300 flex-shrink-0" />
                  <span className="font-bold">Experience AI Analysis</span>
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform duration-300 flex-shrink-0" />
                </Button>
              </Link>
            </div>
          </section>

          {/* Testimonials Section - Hidden until we have real testimonials */}
          {testimonials.length > 0 && (
            <section
              className="mb-24"
              aria-labelledby="testimonials-heading"
              data-testid="testimonials-section"
            >
              <div className="text-center mb-16">
                <Badge className="mb-6 px-4 py-2 bg-gradient-to-r from-green-500/10 to-emerald-600/10 text-green-600 dark:text-green-400 border-green-500/20">
                  Client Success
                </Badge>
                <h2
                  id="testimonials-heading"
                  className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight"
                >
                  Trusted by
                  <br />
                  <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    Legal Leaders
                  </span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                {(testimonials as any[]).map(
                  (testimonial: any, index: number) => (
                    <Card
                      key={index}
                      className="p-8 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                      <CardContent className="p-0">
                        <div className="flex items-center mb-4">
                          {Array.from({ length: testimonial.rating }).map(
                            (_, i: number) => (
                              <Star
                                key={i}
                                className="w-5 h-5 text-yellow-500 fill-current"
                              />
                            ),
                          )}
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mb-6 italic leading-relaxed text-lg">
                          "{testimonial.quote}"
                        </p>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {testimonial.author}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400 text-sm">
                            {testimonial.role}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            </section>
          )}

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
                      Your documents are protected with strong encryption and
                      privacy-preserving AI technology. We never store your
                      documents permanently, and sensitive information is
                      automatically detected and shielded during analysis. Our
                      privacy-first architecture ensures strong confidentiality.
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
                      Our AI analyzes contracts, terms of service, privacy
                      policies, employment agreements, rental agreements, NDAs,
                      purchase agreements, and most other legal documents in
                      English. Upload PDFs, Word docs, or paste text directly
                      for instant analysis.
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
                      Our proprietary privacy-preserving AI has been trained on
                      thousands of legal documents and consistently identifies
                      key clauses, risks, and opportunities with high-quality
                      analysis. While highly accurate, we recommend consulting
                      with a legal professional for critical decisions.
                    </p>
                  </div>
                  <div
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    data-testid="faq-item-3"
                  >
                    <h3 className="font-semibold mb-3 text-gray-900 dark:text-white text-lg">
                      Can I use this for business needs?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Yes, our platform is designed for both individual and
                      business use with advanced security protocols, audit
                      trails, and compliance features suitable for professional
                      legal review. Additional security features and dedicated
                      support are available for business needs.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Final CTA */}
          <section
            className="text-center mb-16"
            data-testid="final-cta-section"
          >
            <Card className="p-12 md:p-16 bg-gradient-to-br from-primary/10 via-secondary/10 to-emerald-600/10 dark:from-primary/20 dark:via-secondary/20 dark:to-emerald-600/20 border-0 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-0">
                
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
                  Ready to Transform
                  <br />
                  <span className="bg-gradient-to-r from-primary via-secondary to-emerald-600 bg-clip-text text-transparent">
                    Your Legal Workflow?
                  </span>
                </h2>
                <p
                  className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed font-light"
                  data-testid="final-cta-description"
                >
                  Experience AI-powered document analysis that delivers instant insights with absolute privacy protection.
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Link to="/upload">
                    <Button
                      className="group bg-gradient-to-r from-primary via-blue-600 to-secondary hover:from-primary/90 hover:via-blue-600/90 hover:to-secondary/90 text-white px-16 py-6 text-2xl font-black shadow-2xl hover:shadow-primary/30 transition-all duration-500 transform hover:-translate-y-2 hover:scale-105"
                      data-testid="final-cta-button"
                    >
                      <Sparkles className="w-7 h-7 mr-4 group-hover:rotate-12 transition-transform duration-300" />
                      Start Free Analysis
                      <ArrowRight className="w-7 h-7 ml-4 group-hover:translate-x-2 transition-transform duration-300" />
                    </Button>
                  </Link>
                  <div className="text-center">
                    <div className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                      🔒 No credit card required • 🚀 Instant setup • ✨ Privacy-first analysis
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </MobileAppWrapper>
    </div>
  );
}