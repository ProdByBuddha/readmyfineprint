import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieConsent } from "@/components/CombinedConsent";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SEOBreadcrumbs } from "@/components/SEOBreadcrumbs";
import { SkipLinks } from "@/components/SkipLinks";
import { PageTransition } from "@/components/PageTransition";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useFocusVisible, useReducedMotion, useHighContrast } from "@/hooks/useAccessibility";
import { useSEO } from "@/lib/seo";
import Home from "@/pages/home";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Cookies from "@/pages/cookies";
import Donate from "@/pages/donate";
import Roadmap from "@/pages/roadmap";
import Subscription from "@/pages/subscription";
import NotFound from "@/pages/not-found";
import { setupAutoSubmission } from "./lib/indexnow";
import React, { useEffect } from 'react';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  useScrollToTop();
  useSEO(location);
  useFocusVisible();
  useReducedMotion();
  useHighContrast();

    // Set up automatic IndexNow submissions
  useEffect(() => {
    setupAutoSubmission();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <SkipLinks />
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
            <ScrollToTop />
            {/* Live region for announcements */}
            <div
              id="announcements"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            ></div>
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;