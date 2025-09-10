import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CookieConsent, CombinedConsent } from "./components/CombinedConsent";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ScrollToTop } from "./components/ScrollToTop";
import { SEOBreadcrumbs } from "./components/SEOBreadcrumbs";
import { SkipLinks } from "./components/SkipLinks";
import { PageTransition } from "./components/PageTransition";
import { useScrollToTop } from "./hooks/useScrollToTop";
import { useFocusVisible, useReducedMotion, useHighContrast } from "./hooks/useAccessibility";
import { useSEO } from "./lib/seo";
import { useToast } from "./hooks/use-toast";
import { setupAutoSubmission } from "./lib/indexnow";
import { errorReporter } from "./lib/error-reporter";
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { authFetch } from './lib/auth-fetch';
import { DirectionProvider } from "@radix-ui/react-direction";
import { SecurityQuestionsProvider, useSecurityQuestions } from "./contexts/SecurityQuestionsContext";
import { SecurityQuestionsModal } from "./components/SecurityQuestionsModal";
import { useSecurityQuestionsHandler } from "./hooks/useSecurityQuestionsHandler";

// Lazy load route components for better code splitting
const Home = lazy(() => import("./pages/home"));
const Upload = lazy(() => import("./pages/upload"));
const Privacy = lazy(() => import("./pages/privacy"));
const Terms = lazy(() => import("./pages/terms"));
const Cookies = lazy(() => import("./pages/cookies"));
const Donate = lazy(() => import("./pages/donate"));
const Roadmap = lazy(() => import("./pages/roadmap"));
const Subscription = lazy(() => import("./pages/subscription"));
const AdminDashboard = lazy(() => import("./pages/admin"));
const EmailRecoveryPage = lazy(() => import("./pages/EmailRecovery").then(module => ({ default: module.EmailRecoveryPage })));
const TrustPage = lazy(() => import("./pages/trust"));
const BlogPage = lazy(() => import("./pages/blog"));
const BlogPostPage = lazy(() => import("./pages/blog-post"));
const UnsubscribePage = lazy(() => import("./pages/unsubscribe"));
const SettingsPage = lazy(() => import("./pages/settings"));
const NotFound = lazy(() => import("./pages/not-found"));

// Loading component for suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route 
              path="/admin" 
              element={<AdminDashboard />} 
            />
        <Route path="/email-recovery" element={<EmailRecoveryPage />} />
        <Route path="/trust" element={<TrustPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

// Inner component that has access to SecurityQuestionsProvider context
function AppContent() {
  const location = useLocation();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { toast } = useToast();
  const { requiresSetup, isLoading } = useSecurityQuestions();
  const { 
    showSecurityQuestionsModal, 
    handleSecurityQuestionsComplete,
    closeSecurityQuestionsModal 
  } = useSecurityQuestionsHandler();

  useScrollToTop();
  useSEO(location.pathname);
  useFocusVisible();
  useReducedMotion();
  useHighContrast();

  // Set up automatic IndexNow submissions
  useEffect(() => {
    setupAutoSubmission();
  }, []);

  // Initialize error reporter
  useEffect(() => {
    // Error reporter is automatically initialized when imported
    if (import.meta.env.DEV) {
      console.log('Error reporting system initialized');
    }
  }, []);

  // Auto-login as admin in development mode
  useEffect(() => {
    const autoLogin = async () => {
      if (import.meta.env.DEV) {
        // Set global flag to prevent other hooks from making auth requests during auto-login
        (window as any).isAutoLoginInProgress = true;

        try {
          // Check if already logged in via session cookie or JWT
          const sessionResponse = await fetch('/api/auth/session', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.authenticated && sessionData.user) {
              // Already logged in, no need to auto-login
              (window as any).isAutoLoginInProgress = false;
              return;
            }
          }

          // Not logged in, try auto-login
          const response = await fetch('/api/dev/auto-admin-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Development auto-login successful:', data);

            // Force a longer delay to ensure session cookies are fully set and processed
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify session is working before triggering events
            const verifyResponse = await fetch('/api/auth/session', {
              method: 'GET',
              credentials: 'include',
            });

            if (verifyResponse.ok) {
              console.log('✅ Session verified, triggering auth events');
              // Only trigger events if session is actually working
              window.dispatchEvent(new Event('authUpdate'));
              window.dispatchEvent(new CustomEvent('authStateChanged'));
            } else {
              console.warn('⚠️ Auto-login succeeded but session verification failed');
            }
          } else {
            console.error('❌ Development auto-login failed:', response.status, response.statusText);
          }
        } catch (error) {
          // Auto-login failed, continue normally - don't log 401s as they're expected
          if (error instanceof Error && !error.message.includes('401') && !error.message.includes('Unauthorized')) {
            console.log('Development auto-login failed:', error.message);
          }
        } finally {
          // Clear the flag regardless of success/failure
          (window as any).isAutoLoginInProgress = false;
        }
      }
    };

    autoLogin();
  }, [toast]);

  // Listen for consent requirement events from API calls
  useEffect(() => {
    const handleConsentRequired = () => {
      // Consent required - showing consent modal
      setShowConsentModal(true);
    };

    window.addEventListener('consentRequired', handleConsentRequired);

    return () => {
      window.removeEventListener('consentRequired', handleConsentRequired);
    };
  }, []);

  // Show security questions modal when required and not loading
  useEffect(() => {
    if (!isLoading && requiresSetup && !showSecurityQuestionsModal) {
      // Give a small delay to ensure the UI is ready
      const timer = setTimeout(() => {
        if (requiresSetup) { // Double check in case it changed
          console.log('Security questions required - showing modal');
          // We need to manually trigger the modal since the useSecurityQuestionsHandler
          // expects an API error, but we're checking proactively
          window.dispatchEvent(new CustomEvent('securityQuestionsRequired'));
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, requiresSetup, showSecurityQuestionsModal]);

  // Handle consent acceptance
  const handleConsentAccepted = () => {
    // Consent accepted - hiding modal
    setShowConsentModal(false);
    // Trigger a page refresh to retry failed requests
    window.location.reload();
  };

  return (
    <>
      <div className="h-screen flex flex-col app-container bg-gray-50 dark:bg-gray-900">
        {/* Fixed Header */}
        <Header />

        {/* Scrollable Main Content Area */}
        <SEOBreadcrumbs />

        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 scroll-smooth custom-scrollbar"
          aria-label="Main content"
        >
          <PageTransition>
            <AppRouter />
          </PageTransition>
        </main>

        {/* Fixed Footer */}
        <Footer />
      </div>
      <Toaster />
      <CookieConsent />
      {showConsentModal && (
        <CombinedConsent onAccept={handleConsentAccepted} />
      )}

      {/* Security Questions Modal */}
      <SecurityQuestionsModal
        isOpen={showSecurityQuestionsModal || (!isLoading && requiresSetup)}
        onComplete={handleSecurityQuestionsComplete}
        onClose={closeSecurityQuestionsModal}
        allowClose={false}
      />

      <ScrollToTop />
      {/* Live region for announcements */}
      <div
        id="announcements"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      ></div>
    </>
  );
}

// Main App component with providers
function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <ErrorBoundary>
              <SkipLinks />
              <DirectionProvider dir="ltr">
                <SecurityQuestionsProvider>
                  <AppContent />
                </SecurityQuestionsProvider>
              </DirectionProvider>
            </ErrorBoundary>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;