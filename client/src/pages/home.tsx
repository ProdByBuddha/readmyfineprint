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
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <TradeSecretProtection />
      <MobileAppWrapper>
        {/* Cookie Consent Banner */}
        {!consentAccepted && (
          <CookieConsentBanner onAccept={() => {
            // The event listener in the hook will trigger the update
          }} />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <section className="text-center mb-16 animate-fade-in-up" role="banner" aria-labelledby="main-heading">
            <div className="absolute inset-0 -top-40 -z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-teal-400/20 rounded-full blur-3xl"></div>
            </div>
            <h1 id="main-heading" className="text-4xl md:text-5xl lg:text-6xl font-bold gradient-text mb-6 leading-tight">
              Privacy-First Legal Document Analysis
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 mb-10 max-w-4xl mx-auto leading-relaxed">
              Get powerful AI insights from contracts, agreements, and legal documents 
              while keeping your sensitive information completely secure.
            </p>

            {/* Call to Action */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <Link to="/upload">
                <Button size="lg" className="px-10 py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 hover:from-blue-700 hover:via-purple-700 hover:to-teal-700 text-white rounded-xl modern-shadow hover:glow-effect transition-all duration-300 transform hover:scale-105">
                  <FileText className="w-6 h-6 mr-3" />
                  Upload Document
                  <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              </Link>
              <Link to="/blog">
                <Button variant="outline" size="lg" className="px-10 py-4 text-lg font-semibold glass-effect border-2 border-slate-200/60 text-slate-700 hover:text-slate-900 hover:border-slate-300/80 rounded-xl modern-shadow transition-all duration-300 transform hover:scale-105">
                  Learn More
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
          <section className="mb-20 animate-fade-in-scale">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center p-8 glass-effect border-0 modern-shadow hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 group">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Secure Processing</h3>
                <p className="text-slate-600 leading-relaxed">
                  Your documents are processed with enterprise-grade security. No data is stored permanently.
                </p>
              </Card>
              <Card className="text-center p-8 glass-effect border-0 modern-shadow hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 group">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-400/20 to-teal-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Clock className="w-10 h-10 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Instant Analysis</h3>
                <p className="text-slate-600 leading-relaxed">
                  Get comprehensive analysis results in seconds, not hours. AI-powered insights delivered fast.
                </p>
              </Card>
              <Card className="text-center p-8 glass-effect border-0 modern-shadow hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 group">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-400/20 to-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="w-10 h-10 text-teal-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Plain English</h3>
                <p className="text-slate-600 leading-relaxed">
                  Complex legal language transformed into clear, understandable summaries and insights.
                </p>
              </Card>
            </div>
          </section>

          {/* Modern bullet points */}
          <section className="mb-20 text-center animate-fade-in-up">
            <div className="glass-effect rounded-2xl p-8 modern-shadow max-w-md mx-auto">
              <div className="space-y-4">
                <p className="text-xl font-semibold text-slate-700 flex items-center justify-center">
                  <span className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-4"></span>
                  Military-Grade Security
                </p>
                <p className="text-xl font-semibold text-slate-700 flex items-center justify-center">
                  <span className="w-3 h-3 bg-gradient-to-r from-purple-500 to-teal-500 rounded-full mr-4"></span>
                  Privacy-Preserving AI
                </p>
              </div>
            </div>
          </section>

          {/* Modern Footer */}
          <footer className="glass-effect rounded-2xl p-8 mt-20 modern-shadow">
            <div className="flex flex-wrap justify-center items-center gap-8 text-slate-600">
              <Link to="/privacy" className="hover:text-slate-900 transition-all duration-300 font-medium hover:scale-105">Privacy</Link>
              <Link to="/terms" className="hover:text-slate-900 transition-all duration-300 font-medium hover:scale-105">Terms</Link>
              <button className="hover:text-blue-600 transition-all duration-300 font-medium hover:scale-105">Cookie Settings</button>
              <Link to="/contact" className="hover:text-slate-900 transition-all duration-300 font-medium hover:scale-105">Contact</Link>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-8 mt-6 text-slate-500">
              <button className="hover:text-pink-600 transition-all duration-300 flex items-center font-medium hover:scale-105">
                <Heart className="w-4 h-4 mr-2" />
                Donate
              </button>
              <Link to="/roadmap" className="hover:text-purple-600 transition-all duration-300 font-medium hover:scale-105">Roadmap</Link>
              <button className="hover:text-blue-600 transition-all duration-300 font-medium hover:scale-105">Share</button>
            </div>
          </footer>

          {/* FAQ Section */}
          <section aria-labelledby="faq-heading" className="mt-24 animate-fade-in-scale">
              <Card className="glass-effect border-0 modern-shadow p-8 md:p-12">
                <CardContent>
                  <h3 id="faq-heading" className="text-3xl md:text-4xl font-bold text-center gradient-text mb-12">
                    Frequently Asked Questions
                  </h3>
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="glass-effect rounded-2xl p-6 md:p-8 modern-shadow hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1">
                      <h4 className="font-bold text-xl mb-4 text-slate-800">How accurate are the summaries?</h4>
                      <p className="text-base leading-relaxed text-slate-600">
                        Our proprietary privacy-preserving analysis technology delivers comprehensive legal insights while 
                        maintaining complete confidentiality. Powered by advanced AI that understands legal language.
                      </p>
                    </div>
                    <div className="glass-effect rounded-2xl p-6 md:p-8 modern-shadow hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1">
                      <h4 className="font-bold text-xl mb-4 text-slate-800">Is my document data secure?</h4>
                      <p className="text-base leading-relaxed text-slate-600">
                        Your sensitive information is automatically detected and shielded using enterprise-grade security protocols. 
                        Our privacy-first architecture ensures sensitive data never leaves your control.
                      </p>
                    </div>
                    <div className="glass-effect rounded-2xl p-6 md:p-8 modern-shadow hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1">
                      <h4 className="font-bold text-xl mb-4 text-slate-800">What types of documents can I analyze?</h4>
                      <p className="text-base leading-relaxed text-slate-600">
                        We support contracts, terms of service, privacy policies, employment agreements, rental agreements,
                        and most other legal documents in English. Upload PDFs, Word docs, or paste text directly.
                      </p>
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