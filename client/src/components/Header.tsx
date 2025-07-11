import { Button } from "@/components/ui/button";
import { Moon, Sun, Heart, Crown, LogOut, Settings, Shield, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import ReactDOM from 'react-dom';
import { SubscriptionLogin } from "@/components/SubscriptionLogin";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Note: Development mode check available if needed
  // const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

  // Shared login status check function
  const checkLoginStatus = useCallback(async () => {
    setIsCheckingAuth(true);
    
    // Validate session with backend using cookies
    try {
      const response = await fetch('/api/users/validate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: include cookies in the request
      });

      if (response.ok) {
        const data = await response.json();
        setIsLoggedIn(true);
        // Check if user is admin based on email
        setIsAdmin(data.email === 'admin@readmyfineprint.com' || data.email === 'prodbybuddha@icloud.com');
      } else {
        // Session is invalid or expired
        setIsLoggedIn(false);
        setIsAdmin(false);
      }
    } catch (error) {
      // On error, assume session is invalid
      console.warn('Session validation failed:', error);
      setIsLoggedIn(false);
      setIsAdmin(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  // Check login status on component mount and when localStorage changes
  useEffect(() => {
    checkLoginStatus();

    // Listen for storage changes (in case user logs in/out in another tab)
    window.addEventListener('storage', checkLoginStatus);
    
    // Also listen for custom auth update events (for same-tab updates)
    const handleAuthUpdate = () => {
      setTimeout(checkLoginStatus, 100); // Small delay to ensure localStorage is updated
    };
    window.addEventListener('authStateChanged', handleAuthUpdate);
    
    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      window.removeEventListener('authStateChanged', handleAuthUpdate);
    };
  }, [checkLoginStatus]);

  const handleSubscriptionClick = () => {
    // Allow navigation to subscription page
  };

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogin(true);
  };

  const handleLogoutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    try {
      // Import logout function dynamically to avoid import issues
      const { logout } = await import('@/lib/api');
      
      // Call the logout API which clears documents and revokes tokens
      const result = await logout();
      
      setIsLoggedIn(false);
      setIsAdmin(false);
      
      toast({
        title: "Logged Out",
        description: result.success 
          ? `Successfully logged out. Cleared ${result.details.tokensRevoked} tokens and ${result.details.documentsCleared ? 'documents' : 'no documents'}.`
          : "Logged out locally. Some server cleanup may have failed.",
      });

      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      
      // Fallback - clear local state even if API fails
      setIsLoggedIn(false);
      setIsAdmin(false);
      
      toast({
        title: "Logged Out",
        description: "Logged out locally. Please refresh if you experience any issues.",
        variant: "destructive",
      });
      
      window.location.href = '/';
    }
  };

  const handleLoginSuccess = async () => {
    setShowLogin(false);
    
    // Re-check login status to validate the token
    await checkLoginStatus();
    
    toast({
      title: "Login Successful",
      description: "Welcome back! You're now logged into your account.",
    });
    
    // Don't redirect - let the user stay on current page
    // window.location.href = '/';
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
            <Link to="/subscription?tab=plans">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                aria-label="View subscription plans"
                onClick={handleSubscriptionClick}
              >
                <Crown className="w-4 h-4 mr-2 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                Plans
              </Button>
            </Link>
            <Link to="/trust">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                aria-label="Trust and security information"
              >
                <Shield className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" aria-hidden="true" />
                Trust
              </Button>
            </Link>
            <Link to="/blog">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                aria-label="Legal insights and contract law blog"
              >
                <BookOpen className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                Blog
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-2"
                  aria-label="Admin Dashboard"
                >
                  <Settings className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  Admin
                </Button>
              </Link>
            )}
            {isCheckingAuth ? (
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                disabled
                aria-label="Checking login status"
              >
                <div className="w-4 h-4 mr-2 border border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                Loading...
              </Button>
            ) : isLoggedIn ? (
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                aria-label="Logout"
                onClick={handleLogoutClick}
              >
                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                Logout
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="mr-2 bg-blue-600 hover:bg-blue-700 text-white"
                aria-label="Login or Subscribe"
                onClick={handleLoginClick}
              >
                Login / Subscribe
              </Button>
            )}
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
            {isCheckingAuth ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs transition-all duration-200"
                disabled
                aria-label="Checking login status"
              >
                <div className="w-3 h-3 mr-1 border border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
              </Button>
            ) : isLoggedIn ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs transition-all duration-200 active:scale-95"
                aria-label="Logout"
                onClick={handleLogoutClick}
              >
                <LogOut className="w-3 h-3 mr-1" aria-hidden="true" />
                Logout
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95"
                aria-label="Login or Subscribe"
                onClick={handleLoginClick}
              >
                Login
              </Button>
            )}
            {!import.meta.env.PROD && (
              <Link to="/subscription?tab=plans">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 rounded-full transition-all duration-200 active:scale-95"
                  aria-label="View subscription plans"
                  onClick={handleSubscriptionClick}
                >
                  <Crown className="w-4 h-4 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 rounded-full transition-all duration-200 active:scale-95"
                  aria-label="Admin Dashboard"
                >
                  <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
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
                <Heart className="w-4 h-4 text-red-500 dark:text-red-400" aria-hidden="true" />
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
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-modal-title"
              >
                <button
                  className="absolute inset-0 w-full h-full cursor-default"
                  onClick={() => setShowLogin(false)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowLogin(false)}
                  aria-label="Close modal"
                  tabIndex={-1}
                />
                <div 
                  className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-2xl relative z-10"
                  role="document"
                >
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