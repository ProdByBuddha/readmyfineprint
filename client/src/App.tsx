import { Switch, Route, useLocation } from "wouter";
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
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useFocusVisible, useReducedMotion, useHighContrast } from "@/hooks/useAccessibility";
import { useSEO } from "@/lib/seo";
import Home from "@/pages/home";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Cookies from "@/pages/cookies";
import DonateSimple from "@/pages/donate-simple";
import Roadmap from "@/pages/roadmap";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/cookies" component={Cookies} />
      <Route path="/donate" component={DonateSimple} />
      <Route path="/roadmap" component={Roadmap} />
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

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <SkipLinks />
            <div className="h-screen flex flex-col app-container">
              {/* Fixed Header */}
              <Header />

              {/* Scrollable Main Content Area */}
              <SEOBreadcrumbs />
              
              <main
                id="main-content"
                role="main"
                tabIndex={-1}
                className="flex-1 overflow-y-auto"
                aria-label="Main content"
              >
                <Router />
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
