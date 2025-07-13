import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieConsent, CombinedConsent } from "@/components/CombinedConsent";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SEOBreadcrumbs } from "@/components/SEOBreadcrumbs";
import { SkipLinks } from "@/components/SkipLinks";
import { PageTransition } from "@/components/PageTransition";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useFocusVisible, useReducedMotion, useHighContrast } from "@/hooks/useAccessibility";
import { useSEO } from "@/lib/seo";
import { useToast } from "@/hooks/use-toast";
import { setupAutoSubmission } from "./lib/indexnow";
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { DirectionProvider } from "@radix-ui/react-direction";

// Lazy load route components for better code splitting
const Home = lazy(() => import("@/pages/home"));
const Upload = lazy(() => import("@/pages/upload"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const Cookies = lazy(() => import("@/pages/cookies"));
const Donate = lazy(() => import("@/pages/donate"));
const Roadmap = lazy(() => import("@/pages/roadmap"));
const Subscription = lazy(() => import("@/pages/subscription"));
const AdminDashboard = lazy(() => import("@/pages/admin"));
const EmailRecoveryPage = lazy(() => import("@/pages/EmailRecovery").then(module => ({ default: module.EmailRecoveryPage })));
const TrustPage = lazy(() => import("@/pages/trust"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const UnsubscribePage = lazy(() => import("@/pages/unsubscribe"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading component for suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/upload" component={Upload} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/cookies" component={Cookies} />
        <Route path="/donate" component={Donate} />
        <Route path="/roadmap" component={Roadmap} />
        <Route 
              path="/subscription" 
              component={() => 
                import.meta.env.PROD ? 
                  <Redirect to="/" replace /> : 
                  <Subscription />
              } 
            />
        <Route 
              path="/admin" 
              component={AdminDashboard} 
            />
        <Route path="/email-recovery" component={EmailRecoveryPage} />
        <Route path="/trust" component={TrustPage} />
        <Route path="/blog" component={BlogPage} />
        <Route path="/blog/:slug" component={BlogPostPage} />
        <Route path="/unsubscribe" component={UnsubscribePage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const [location] = useLocation();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { toast } = useToast();
  
  useScrollToTop();
  useSEO(location);
  useFocusVisible();
  useReducedMotion();
  useHighContrast();

  // Set up automatic IndexNow submissions
  useEffect(() => {
    setupAutoSubmission();
  }, []);

  // Auto-login as admin in development mode
  useEffect(() => {
    const autoLogin = async () => {
      if (import.meta.env.DEV && !localStorage.getItem('token')) {
        try {
          const response = await fetch('/api/dev/auto-admin-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.user));
            // Auto-logged in as admin in development mode
            
            // Show notification
            toast({
              title: "Development Mode",
              description: "You've been automatically logged in as admin",
              duration: 5000,
            });
          }
        } catch (error) {
          // Auto-login failed
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

  // Handle consent acceptance
  const handleConsentAccepted = () => {
    // Consent accepted - hiding modal
    setShowConsentModal(false);
    // Trigger a page refresh to retry failed requests
    window.location.reload();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <SkipLinks />
            <DirectionProvider dir="ltr">
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
                    <Router />
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
              <ScrollToTop />
              {/* Live region for announcements */}
              <div
                id="announcements"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              ></div>
            </DirectionProvider>
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;