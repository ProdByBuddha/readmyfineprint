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
    <div ref={containerRef} className="bg-gray-100 min-h-screen">
      <TradeSecretProtection />
      <MobileAppWrapper>
        {/* Cookie Consent Banner */}
        {!consentAccepted && (
          <CookieConsentBanner onAccept={() => {
            // The event listener in the hook will trigger the update
          }} />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Hero Section */}
          <section className="text-center mb-12" role="banner" aria-labelledby="main-heading">
            <h1 id="main-heading" className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Privacy-First Legal Document Analysis
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Get powerful AI insights from contracts, agreements, and legal documents 
              while keeping your sensitive information completely secure.
            </p>

            {/* Call to Action */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Link to="/upload">
                <Button size="lg" className="px-8 py-3 text-lg bg-teal-600 hover:bg-teal-700 text-white">
                  <FileText className="w-5 h-5 mr-2" />
                  Upload Document
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/blog">
                <Button variant="outline" size="lg" className="px-8 py-3 text-lg border-gray-300 text-gray-700 hover:bg-gray-50">
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
          <section className="mb-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center p-6">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Secure Processing</h3>
                <p className="text-gray-600">
                  Your documents are processed with enterprise-grade security. No data is stored permanently.
                </p>
              </Card>
              <Card className="text-center p-6">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Instant Analysis</h3>
                <p className="text-gray-600">
                  Get comprehensive analysis results in seconds, not hours. AI-powered insights delivered fast.
                </p>
              </Card>
              <Card className="text-center p-6">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Plain English</h3>
                <p className="text-gray-600">
                  Complex legal language transformed into clear, understandable summaries and insights.
                </p>
              </Card>
            </div>
          </section>

          {/* Simple bullet points below features */}
          <section className="mb-16 text-center">
            <div className="space-y-3">
              <p className="text-lg text-gray-600 flex items-center justify-center">
                <span className="w-2 h-2 bg-teal-600 rounded-full mr-3"></span>
                Military-Grade Security
              </p>
              <p className="text-lg text-gray-600 flex items-center justify-center">
                <span className="w-2 h-2 bg-teal-600 rounded-full mr-3"></span>
                Privacy-Preserving AI
              </p>
            </div>
          </section>

          {/* Simple Footer */}
          <footer className="border-t border-gray-200 pt-8 mt-16">
            <div className="flex flex-wrap justify-center items-center gap-6 text-gray-600">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms</Link>
              <button className="hover:text-gray-900 transition-colors">Cookie Settings</button>
              <Link to="/contact" className="hover:text-gray-900 transition-colors">Contact</Link>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-6 mt-6 text-gray-500">
              <button className="hover:text-gray-700 transition-colors flex items-center">
                <Heart className="w-4 h-4 mr-1" />
                Donate
              </button>
              <Link to="/roadmap" className="hover:text-gray-700 transition-colors">Roadmap</Link>
              <button className="hover:text-gray-700 transition-colors">Share</button>
            </div>
          </footer>

          {/* FAQ Section */}
          <section aria-labelledby="faq-heading" className="mt-16 animate-fade-in-scale">
              <Card className="p-6 md:p-8">
                <CardContent>
                  <h3 id="faq-heading" className="text-xl md:text-2xl font-semibold mb-6 md:mb-8 text-center text-gray-900 dark:text-white">
                    Frequently Asked Questions
                  </h3>
                  <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-white">How accurate are the summaries?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        Our proprietary privacy-preserving analysis technology delivers comprehensive legal insights while 
                        maintaining complete confidentiality. Powered by advanced AI that understands legal language.
                      </p>
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Is my document data secure?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        Your sensitive information is automatically detected and shielded using enterprise-grade security protocols. 
                        Our privacy-first architecture ensures sensitive data never leaves your control.
                      </p>
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-white">What types of documents can I analyze?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
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