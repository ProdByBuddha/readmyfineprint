import { useState, useEffect } from 'react';
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

  // Check authentication status on component mount and when location changes
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setIsLoggedIn(true);
          setIsAdmin(parsedUser.email === 'admin@readmyfineprint.com' || parsedUser.email === 'prodbybuddha@icloud.com');
        } catch (error) {
          console.error('Error parsing user data:', error);
          // Clear invalid data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsLoggedIn(false);
          setUser(null);
          setIsAdmin(false);
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setIsAdmin(false);
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
    
    // Listen for auth updates
    const handleAuthUpdate = () => {
      checkAuth();
    };

    window.addEventListener('authUpdate', handleAuthUpdate);
    
    return () => {
      window.removeEventListener('authUpdate', handleAuthUpdate);
    };
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
    
    // Refresh auth state
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsLoggedIn(true);
        setIsAdmin(parsedUser.email === 'admin@readmyfineprint.com' || parsedUser.email === 'prodbybuddha@icloud.com');
        
        // Trigger auth update event for other components
        window.dispatchEvent(new Event('authUpdate'));
        
        toast({
          title: "Login successful",
          description: `Welcome back, ${parsedUser.email}!`,
          duration: 3000,
        });
        
      } catch (error) {
        console.error('Error parsing user data after login:', error);
      }
    }
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