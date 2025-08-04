import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, CheckCircle, FileText, Heart } from "lucide-react";
import { usePreventFlicker } from "@/hooks/usePreventFlicker";
import TradeSecretProtection from "@/components/TradeSecretProtection";

import { MobileAppWrapper } from "@/components/MobileAppWrapper";
import { useCombinedConsent } from "@/components/CombinedConsent";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { generateFAQSchema, updateSEO } from "@/lib/seo";
import { LoginForm } from "@/components/LoginForm";
import { useLocation, useNavigate, Link } from "react-router-dom";
import type { Document } from "@shared/schema";

export default function Home() {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAccepted: consentAccepted } = useCombinedConsent();
  const containerRef = usePreventFlicker();

  // Check for admin login redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'admin') {
      setShowAdminLogin(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Add FAQ structured data for SEO
  useEffect(() => {
    const faqData = [
      {
        question: "How accurate are the summaries?",
        answer: "Our advanced analysis engine has processed thousands of legal documents and is trained to identify common patterns and concerning clauses. While highly accurate, we recommend consulting with a legal professional for critical decisions."
      },
      {
        question: "Is my document data secure?",
        answer: "Yes, all documents are encrypted in transit and at rest. We don't store your documents after analysis, and you can delete your summaries at any time."
      },
      {
        question: "What types of documents can I analyze?",
        answer: "We support contracts, terms of service, privacy policies, employment agreements, rental agreements, and most other legal documents in English."
      }
    ];

    updateSEO({
      structuredData: generateFAQSchema(faqData)
    });
  }, []);

  // Check if user has a subscription (non-free tier)
  const hasSubscription = () => {
    const subscriptionToken = localStorage.getItem('subscriptionToken');
    return !!subscriptionToken;
  };

  return (
    <div ref={containerRef} className="min-h-screen hero-gradient relative overflow-hidden">
      <TradeSecretProtection />
      <MobileAppWrapper>
        {/* Cookie Consent Banner */}
        {!consentAccepted && (
          <CookieConsentBanner onAccept={() => {
            // The event listener in the hook will trigger the update
          }} />
        )}
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-gradient-to-r from-pink-500/10 to-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Hero Section */}
          <section className="text-center mb-24 animate-fade-in-up" role="banner" aria-labelledby="main-heading">
            <div className="max-w-5xl mx-auto">
              <h1 id="main-heading" className="text-5xl md:text-6xl lg:text-7xl font-black gradient-text-modern mb-8 leading-[1.1] tracking-tight">
                Privacy-First Legal Document Analysis
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-4xl mx-auto leading-relaxed font-light">
                Transform complex legal documents into clear, actionable insights with enterprise-grade security 
                and privacy-preserving AI technology.
              </p>
            </div>

            {/* Call to Action */}
            <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-16">
              <Link to="/upload" className="group">
                <Button size="lg" className="modern-button relative px-12 py-6 text-xl font-bold text-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02] group-hover:-translate-y-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative flex items-center">
                    <FileText className="w-7 h-7 mr-4" />
                    Upload Document
                    <ArrowRight className="w-6 h-6 ml-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </Button>
              </Link>
              <Link to="/blog" className="group">
                <Button variant="outline" size="lg" className="glass-card px-12 py-6 text-xl font-bold border-2 border-slate-200/80 text-slate-700 hover:text-slate-900 hover:border-slate-300 transition-all duration-500 transform hover:scale-[1.02] group-hover:-translate-y-2">
                  <span className="relative">Learn More</span>
                </Button>
              </Link>
            </div>

            {/* Features highlight for SEO */}
            <div className="mb-6 max-w-4xl mx-auto">
              <h2 className="sr-only">Key Features</h2>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" aria-hidden="true"></span>
                  <span>Military-Grade Security</span>
                </li>
                <li className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" aria-hidden="true"></span>
                  <span>Privacy-Preserving AI</span>
                </li>
                <li className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" aria-hidden="true"></span>
                  <span>Complete Audit Trails</span>
                </li>
              </ul>
            </div>

            {/* Session-based tool notification */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 max-w-2xl mx-auto" role="alert" aria-labelledby="privacy-notice">
              <h3 id="privacy-notice" className="sr-only">Privacy Notice</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Enterprise-Grade Security:</strong> Your sensitive information is automatically protected using 
                advanced privacy technology. Documents processed with complete confidentiality.
              </p>
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-32 animate-modern-fade">
            <div className="modern-grid">
              <Card className="group relative overflow-hidden text-center p-10 glass-card border-0 shadow-lg hover:shadow-2xl transition-all duration-700 transform hover:-translate-y-3 hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <Shield className="w-12 h-12 text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-6 group-hover:gradient-text-modern transition-all duration-500">Enterprise Security</h3>
                  <p className="text-lg text-slate-600 leading-relaxed font-light">
                    Military-grade encryption and zero-trust architecture ensure your sensitive documents remain completely private and secure.
                  </p>
                </div>
              </Card>
              
              <Card className="group relative overflow-hidden text-center p-10 glass-card border-0 shadow-lg hover:shadow-2xl transition-all duration-700 transform hover:-translate-y-3 hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500/10 to-pink-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <Clock className="w-12 h-12 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-6 group-hover:gradient-text-modern transition-all duration-500">Lightning Fast</h3>
                  <p className="text-lg text-slate-600 leading-relaxed font-light">
                    Advanced AI processing delivers comprehensive legal insights in seconds, not hours. Real-time analysis at enterprise scale.
                  </p>
                </div>
              </Card>
              
              <Card className="group relative overflow-hidden text-center p-10 glass-card border-0 shadow-lg hover:shadow-2xl transition-all duration-700 transform hover:-translate-y-3 hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-pink-500/10 to-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <CheckCircle className="w-12 h-12 text-pink-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-6 group-hover:gradient-text-modern transition-all duration-500">Human Readable</h3>
                  <p className="text-lg text-slate-600 leading-relaxed font-light">
                    Transform complex legal jargon into clear, actionable insights. No law degree required to understand your documents.
                  </p>
                </div>
              </Card>
            </div>
          </section>

          {/* Trust Indicators */}
          <section className="mb-32 text-center animate-fade-in-up">
            <div className="relative glass-effect rounded-3xl p-12 premium-shadow max-w-2xl mx-auto overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5"></div>
              <div className="relative space-y-8">
                <div className="flex items-center justify-center group">
                  <div className="w-4 h-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mr-6 group-hover:scale-125 transition-transform duration-300"></div>
                  <p className="text-2xl font-black text-slate-800 group-hover:gradient-text transition-all duration-300">
                    Zero-Trust Architecture
                  </p>
                </div>
                <div className="flex items-center justify-center group">
                  <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mr-6 group-hover:scale-125 transition-transform duration-300"></div>
                  <p className="text-2xl font-black text-slate-800 group-hover:gradient-text transition-all duration-300">
                    Privacy-First AI
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Premium Footer */}
          <footer className="relative glass-effect rounded-3xl p-12 mt-32 premium-shadow overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5"></div>
            <div className="relative">
              <div className="flex flex-wrap justify-center items-center gap-12 text-slate-700">
                <Link to="/privacy" className="group text-lg font-semibold hover:gradient-text transition-all duration-500 hover:scale-110 hover:-translate-y-1">
                  <span className="relative">
                    Privacy
                    <div className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"></div>
                  </span>
                </Link>
                <Link to="/terms" className="group text-lg font-semibold hover:gradient-text transition-all duration-500 hover:scale-110 hover:-translate-y-1">
                  <span className="relative">
                    Terms
                    <div className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"></div>
                  </span>
                </Link>
                <button className="group text-lg font-semibold hover:gradient-text transition-all duration-500 hover:scale-110 hover:-translate-y-1">
                  <span className="relative">
                    Cookie Settings
                    <div className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-0.5 bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-300"></div>
                  </span>
                </button>
                <Link to="/contact" className="group text-lg font-semibold hover:gradient-text transition-all duration-500 hover:scale-110 hover:-translate-y-1">
                  <span className="relative">
                    Contact
                    <div className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"></div>
                  </span>
                </Link>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-12 mt-10 text-slate-600">
                <button className="group flex items-center text-lg font-semibold hover:text-pink-600 transition-all duration-500 hover:scale-110 hover:-translate-y-1">
                  <Heart className="w-5 h-5 mr-3 group-hover:scale-125 transition-transform duration-300" />
                  <span>Donate</span>
                </button>
                <Link to="/roadmap" className="group text-lg font-semibold hover:text-purple-600 transition-all duration-500 hover:scale-110 hover:-translate-y-1">
                  <span>Roadmap</span>
                </Link>
                <button className="group text-lg font-semibold hover:text-indigo-600 transition-all duration-500 hover:scale-110 hover:-translate-y-1">
                  <span>Share</span>
                </button>
              </div>
            </div>
          </footer>

          {/* FAQ Section */}
          <section aria-labelledby="faq-heading" className="mt-40 animate-fade-in-scale">
              <Card className="relative glass-effect border-0 premium-shadow p-12 md:p-16 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5"></div>
                <CardContent className="relative">
                  <h3 id="faq-heading" className="text-4xl md:text-5xl font-black text-center gradient-text mb-16">
                    Frequently Asked Questions
                  </h3>
                  <div className="max-w-5xl mx-auto space-y-8">
                    <div className="group relative glass-effect rounded-3xl p-8 md:p-12 premium-shadow hover:glow-effect transition-all duration-700 transform hover:-translate-y-2 hover:scale-[1.01] overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="relative">
                        <h4 className="font-black text-2xl mb-6 text-slate-900 group-hover:gradient-text transition-all duration-500">How accurate are the summaries?</h4>
                        <p className="text-lg leading-relaxed text-slate-600 font-light">
                          Our proprietary privacy-preserving analysis technology delivers comprehensive legal insights while 
                          maintaining complete confidentiality. Powered by advanced AI that understands complex legal language with enterprise-grade accuracy.
                        </p>
                      </div>
                    </div>
                    <div className="group relative glass-effect rounded-3xl p-8 md:p-12 premium-shadow hover:glow-effect transition-all duration-700 transform hover:-translate-y-2 hover:scale-[1.01] overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="relative">
                        <h4 className="font-black text-2xl mb-6 text-slate-900 group-hover:gradient-text transition-all duration-500">Is my document data secure?</h4>
                        <p className="text-lg leading-relaxed text-slate-600 font-light">
                          Your sensitive information is automatically detected and shielded using military-grade security protocols. 
                          Our zero-trust architecture ensures sensitive data never leaves your control, with end-to-end encryption and automatic data purging.
                        </p>
                      </div>
                    </div>
                    <div className="group relative glass-effect rounded-3xl p-8 md:p-12 premium-shadow hover:glow-effect transition-all duration-700 transform hover:-translate-y-2 hover:scale-[1.01] overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="relative">
                        <h4 className="font-black text-2xl mb-6 text-slate-900 group-hover:gradient-text transition-all duration-500">What types of documents can I analyze?</h4>
                        <p className="text-lg leading-relaxed text-slate-600 font-light">
                          We support contracts, terms of service, privacy policies, employment agreements, rental agreements,
                          and most other legal documents in English. Upload PDFs, Word docs, or paste text directly for instant analysis.
                        </p>
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