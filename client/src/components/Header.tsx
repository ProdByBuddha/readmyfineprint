import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { FileText, User, LogOut, Settings, Menu, X, Crown, Shield, AlertCircle, Moon, Sun, Heart, BookOpen } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { logout } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { clearSession } from '@/lib/sessionManager';
import { clearCSRFToken } from '@/lib/csrfManager';
import { useTheme } from '@/components/ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { SubscriptionLogin } from '@/components/SubscriptionLogin';
import ReactDOM from 'react-dom';

export function Header() {
  const [location, navigate] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const burgerButtonRef = useRef<HTMLButtonElement>(null);

  // Check authentication status on component mount and when location changes
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      
      try {
        // Check session cookie authentication via the session endpoint
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionStorage.getItem('app-session-id') || 'anonymous',
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          // Check if user is authenticated
          if (data.authenticated && data.user) {
            setUser(data.user);
            setIsLoggedIn(true);
            setIsAdmin(data.user.email === 'admin@readmyfineprint.com' || data.user.email === 'prodbybuddha@icloud.com');
          } else {
            // User is not authenticated
            setIsLoggedIn(false);
            setUser(null);
            setIsAdmin(false);
          }
        } else {
          // Session validation failed
          setIsLoggedIn(false);
          setUser(null);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsLoggedIn(false);
        setUser(null);
        setIsAdmin(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
    
    // Listen for auth updates
    const handleAuthUpdate = () => {
      checkAuth();
    };

    window.addEventListener('authUpdate', handleAuthUpdate);
    window.addEventListener('authStateChanged', handleAuthUpdate);
    
    return () => {
      window.removeEventListener('authUpdate', handleAuthUpdate);
      window.removeEventListener('authStateChanged', handleAuthUpdate);
    };
  }, [location]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) &&
          burgerButtonRef.current && !burgerButtonRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleSubscriptionClick = () => {
    navigate('/subscription?tab=plans');
  };

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogin(true);
  };

  const handleLogoutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    try {
      // Call the logout API which clears documents and revokes tokens
      const result = await logout();
      
      setIsLoggedIn(false);
      setUser(null);
      setIsAdmin(false);
      
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Clear session and CSRF tokens
      clearSession();
      clearCSRFToken();
      
      // Show success message
      toast({
        title: "Logged out successfully",
        description: `${result.details.tokensRevoked} tokens revoked, documents cleared`,
        duration: 3000,
      });
      
      // Redirect to home
      navigate('/');
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if API call fails, clear local data
      setIsLoggedIn(false);
      setUser(null);
      setIsAdmin(false);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      clearSession();
      clearCSRFToken();
      
      toast({
        title: "Logged out",
        description: "Session cleared locally",
        duration: 3000,
      });
      
      navigate('/');
    }
  };

  const handleLoginSuccess = async () => {
    setShowLogin(false);
    
    // Trigger auth update event for other components to refresh their state
    window.dispatchEvent(new Event('authUpdate'));
    window.dispatchEvent(new CustomEvent('authStateChanged'));
    
    // The auth state will be updated by the useEffect that listens to these events
    // and calls checkAuth which will fetch the current session state
    
    toast({
      title: "Login successful",
      description: "Welcome back!",
      duration: 3000,
    });
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
              <div className={`${isMobile ? 'p-1' : 'p-1.5'} bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl shadow-sm group-hover:shadow-md transition-all duration-200 group-active:scale-95`}>
                <img
                  src="/og-image.png"
                  alt="ReadMyFinePrint Logo"
                  className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} object-contain rounded-lg`}
                />
              </div>
              <h1 className="text-xl font-bold text-primary dark:text-primary hidden md:block">
                ReadMyFinePrint
              </h1>
              {isMobile && (
                <h1 className="text-lg font-bold text-primary dark:text-primary tracking-tight">
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
            className="md:hidden flex items-center space-x-2"
            role="navigation"
            aria-label="Mobile navigation"
          >
            {/* Primary actions - always visible */}
            <div className="flex items-center space-x-2">
              {isCheckingAuth ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs transition-all duration-200"
                  disabled
                  aria-label="Checking login status"
                >
                  <div className="w-3 h-3 mr-1 border border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                </Button>
              ) : isLoggedIn ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs transition-all duration-200 active:scale-95"
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
                  className="h-9 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95"
                  aria-label="Login or Subscribe"
                  onClick={handleLoginClick}
                >
                  Login
                </Button>
              )}
              
              {/* Burger menu button */}
              <Button
                ref={burgerButtonRef}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 transition-all duration-200 active:scale-95"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Menu className="w-5 h-5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </nav>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div 
            ref={mobileMenuRef}
            className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 shadow-lg animate-in slide-in-from-top-2 duration-200"
          >
            <div className="px-4 py-3 space-y-2">
              <Link to="/subscription?tab=plans">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                  aria-label="View subscription plans"
                  onClick={() => {
                    handleSubscriptionClick();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Crown className="w-4 h-4 mr-3 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                  Plans
                </Button>
              </Link>
              
              <Link to="/trust">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                  aria-label="Trust and security information"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Shield className="w-4 h-4 mr-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                  Trust
                </Button>
              </Link>
              
              <Link to="/blog">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                  aria-label="Legal insights and contract law blog"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <BookOpen className="w-4 h-4 mr-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                  Blog
                </Button>
              </Link>
              
              {isAdmin && (
                <Link to="/admin">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                    aria-label="Admin Dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    Admin
                  </Button>
                </Link>
              )}
              
              <Link to="/donate">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                  aria-label="Support us with a donation"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Heart className="w-4 h-4 mr-3 text-red-500 dark:text-red-400" aria-hidden="true" />
                  Donate
                </Button>
              </Link>
              
              <Button
                onClick={() => {
                  toggleTheme();
                  setIsMobileMenuOpen(false);
                }}
                variant="ghost"
                size="sm"
                className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
                aria-pressed={theme === "dark"}
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4 mr-3" aria-hidden="true" />
                ) : (
                  <Sun className="w-4 h-4 mr-3" aria-hidden="true" />
                )}
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </Button>
            </div>
          </div>
        )}
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