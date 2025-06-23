import { Button } from "@/components/ui/button";
import { Moon, Sun, Heart, Crown } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import ReactDOM from 'react-dom';
import { SubscriptionLogin } from "@/components/SubscriptionLogin";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [showLogin, setShowLogin] = useState(false);

  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

  const handleSubscriptionClick = (e: React.MouseEvent) => {
    // Allow navigation to subscription page
  };

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogin(true);
  };

  const handleLoginSuccess = (token: string, subscription: any) => {
    setShowLogin(false);
    toast({
      title: "Login Successful",
      description: "Welcome back! You're now logged into your account.",
    });
    // Optionally redirect to subscription page or refresh data
    window.location.href = '/subscription';
  };

  return (
    <header
      id="navigation"
      role="banner"
      className={`
        ${isMobile
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b-0 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-b border-teal-200 dark:border-slate-700'
        }
        flex-shrink-0 z-50 transition-all duration-300
      `}
      style={isMobile ? {
        paddingTop: 'var(--app-safe-area-top)',
        paddingLeft: 'var(--app-safe-area-left)',
        paddingRight: 'var(--app-safe-area-right)'
      } : {}}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center ${isMobile ? 'h-14' : 'h-16'}`}>
          <Link to="/" aria-label="ReadMyFinePrint - Go to homepage">
            <div className="flex items-center space-x-3 cursor-pointer group">
              <img
                src="/og-image.png"
                alt="ReadMyFinePrint Logo"
                className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} object-contain rounded-lg transition-transform duration-200 group-active:scale-95`}
              />
              <h1 className="text-xl font-bold text-primary dark:text-primary hidden md:block">
                ReadMyFinePrint
              </h1>
              {isMobile && (
                <h1 className="text-lg font-bold text-primary dark:text-primary">
                  RMFP
                </h1>
              )}
            </div>
          </Link>

          <nav
            className="hidden md:flex items-center space-x-6"
            role="navigation"
            aria-label="Main navigation"
          >
            <Link to="/subscription">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                aria-label="Manage subscription"
                onClick={handleSubscriptionClick}
              >
                <Crown className="w-4 h-4 mr-2 text-yellow-600" aria-hidden="true" />
                Plans
              </Button>
            </Link>
            <Button
              variant="default"
              size="sm"
              className="mr-2 bg-blue-600 hover:bg-blue-700 text-white"
              aria-label="Login or Subscribe"
              onClick={handleLoginClick}
            >
              Login / Subscribe
            </Button>
            <Link to="/donate">
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                aria-label="Support us with a donation"
              >
                <Heart className="w-4 h-4 mr-2 text-red-500" aria-hidden="true" />
                Donate
              </Button>
            </Link>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="sm"
              className="mr-2"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              </span>
            </Button>
          </nav>

          {/* Mobile navigation */}
          <nav
            className="md:hidden flex items-center space-x-1"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95"
              aria-label="Login or Subscribe"
              onClick={handleLoginClick}
            >
              Login
            </Button>
            {!import.meta.env.PROD && (
              <Link to="/subscription">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 rounded-full transition-all duration-200 active:scale-95"
                  aria-label="Manage subscription"
                  onClick={handleSubscriptionClick}
                >
                  <Crown className="w-4 h-4 text-yellow-600" aria-hidden="true" />
                </Button>
              </Link>
            )}
            <Link to="/donate">
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 rounded-full transition-all duration-200 active:scale-95"
                aria-label="Support us with a donation"
              >
                <Heart className="w-4 h-4 text-red-500" aria-hidden="true" />
              </Button>
            </Link>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 rounded-full transition-all duration-200 active:scale-95"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              </span>
            </Button>
          </nav>
        </div>
      </div>

      {/* Login Modal - Portal to document body */}
      {showLogin && (
        <>
          {document.body && 
            ReactDOM.createPortal(
              <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-2xl">
                  <SubscriptionLogin
                    onSuccess={handleLoginSuccess}
                    onCancel={() => setShowLogin(false)}
                  />
                </div>
              </div>,
              document.body
            )
          }
        </>
      )}
    </header>
  );
}