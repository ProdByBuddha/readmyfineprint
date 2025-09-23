import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import {
  Crown,
  BookOpen,
  Settings,
  Heart,
  Moon,
  Sun,
  LogOut,
  Menu,
  Loader2
} from 'lucide-react';
import { SubscriptionLogin } from './SubscriptionLogin';
import { logout } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { clearSession } from '@/lib/sessionManager';
import { clearCSRFToken } from '@/lib/csrfManager';
import { queryClient } from '@/lib/queryClient';
import { safeDispatchEvent } from '@/lib/safeDispatchEvent';
import { useTheme } from '@/components/ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { authFetch } from '@/lib/auth-fetch';

interface User {
  email: string;
  id: string;
  // Add other user properties as needed
}

interface AuthSession {
  authenticated: boolean;
  user?: User;
  sessionId?: string;
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  // Use react-query for auth state management
  const { 
    data: authData, 
    isLoading: isCheckingAuth, 
    refetch: refetchAuth 
  } = useQuery<AuthSession>({
    queryKey: ['/api/auth/session'],
    queryFn: async () => {
      try {
        const response = await authFetch('/api/auth/session', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data: any = await response.json();
          if (data.authenticated && data.user) {
            return data as AuthSession;
          } else {
            // Try development auto-login if in dev mode and not authenticated
            if (import.meta.env.DEV && response.status !== 401) {
              try {
                const autoLoginResponse = await authFetch('/api/dev/auto-admin-login', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                });
                
                if (autoLoginResponse.ok) {
                  // Wait for cookies to be set, then check auth again
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  const retryResponse = await authFetch('/api/auth/session', {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  if (retryResponse.ok) {
                    const retryData: any = await retryResponse.json();
                    if (retryData.authenticated && retryData.user) {
                      toast({
                        title: "Development Mode",
                        description: "You've been automatically logged in as admin",
                        duration: 3000,
                      });
                      return retryData as AuthSession;
                    }
                  }
                }
              } catch (autoLoginError) {
                console.error('Auto-login failed:', autoLoginError);
              }
            }
            return { authenticated: false };
          }
        } else {
          return { authenticated: false };
        }
      } catch (error) {
        // Only log unexpected errors, not normal authentication failures
        if (error instanceof Error && error.message && !error.message.includes('401') && !error.message.includes('Unauthorized')) {
          console.error('Error checking authentication:', error);
        }
        return { authenticated: false };
      }
    },
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const isLoggedIn = authData?.authenticated ?? false;
  const user = authData?.user;
  const isAdmin = user?.email === 'admin@readmyfineprint.com' || user?.email === 'prodbybuddha@icloud.com';

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
      
      // Clear any remaining localStorage items from old auth system
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Clear JWT tokens used for fallback authentication
      localStorage.removeItem('jwt_access_token');
      localStorage.removeItem('jwt_refresh_token');
      
      // Clear subscription tokens
      localStorage.removeItem('subscriptionToken');
      localStorage.removeItem('subscription_token');
      
      // Clear session and CSRF tokens
      clearSession();
      clearCSRFToken();
      
      // Clear all cached query data
      queryClient.clear();
      
      // Show success message
      toast({
        title: "Logged out successfully",
        description: `${result.details.tokensRevoked} tokens revoked, documents cleared`,
        duration: 3000,
      });
      
      // Force page reload to clear all cached state
      window.location.href = '/';
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if API call fails, clear local data
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('jwt_access_token');
      localStorage.removeItem('jwt_refresh_token');
      localStorage.removeItem('subscriptionToken');
      localStorage.removeItem('subscription_token');
      
      clearSession();
      clearCSRFToken();
      queryClient.clear();
      
      toast({
        title: "Logged out",
        description: "Session cleared locally",
        duration: 3000,
      });
      
      window.location.href = '/';
    }
  };

  const handleLoginSuccess = async () => {
    setShowLogin(false);
    
    // Refetch auth data to update the UI
    await refetchAuth();
    
    // Trigger auth update event for other components
    safeDispatchEvent('authUpdate');
    safeDispatchEvent('authStateChanged');
    
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
      data-testid="header"
      className={`
        ${isMobile
          ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/10 dark:border-slate-800/50 shadow-lg'
          : 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-slate-800/60 shadow-md'
        }
        flex-shrink-0 z-50 transition-all duration-500 ease-out supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-slate-900/80
      `}
      style={isMobile ? {
        paddingTop: 'var(--app-safe-area-top)',
        paddingLeft: 'var(--app-safe-area-left)',
        paddingRight: 'var(--app-safe-area-right)'
      } : {}}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center ${isMobile ? 'h-14' : 'h-16'}`}>
          {/* Logo - Fixed size with strict constraints */}
          <Link 
            to="/" 
            aria-label="ReadMyFinePrint - Go to homepage"
            data-testid="logo-link"
          >
            <div className="flex items-center space-x-3 cursor-pointer group">
              {/* Logo container with fixed size and overflow hidden */}
              <div 
                className={`
                  ${isMobile ? 'w-8 h-8' : 'w-10 h-10'} 
                  bg-gradient-to-br from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30 
                  rounded-xl shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300 ease-out
                  group-active:scale-95 flex items-center justify-center 
                  flex-none shrink-0 overflow-hidden border border-primary/10 dark:border-primary/20
                `}
              >
                <img
                  src="/og-image.png"
                  alt="ReadMyFinePrint Logo"
                  data-testid="logo-image"
                  width={isMobile ? 32 : 40}
                  height={isMobile ? 32 : 40}
                  className={`
                    ${isMobile ? 'size-8' : 'size-10'} 
                    object-contain flex-none shrink-0 rounded-lg
                  `}
                  style={{ 
                    maxWidth: isMobile ? '32px' : '40px', 
                    maxHeight: isMobile ? '32px' : '40px' 
                  }}
                />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-600 bg-clip-text text-transparent hidden md:block">
                ReadMyFinePrint
              </h1>
              {isMobile && (
                <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary-600 bg-clip-text text-transparent tracking-tight">
                  RMFP
                </h1>
              )}
            </div>
          </Link>

          {/* Desktop Navigation */}
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
                data-testid="nav-plans"
                onClick={handleSubscriptionClick}
              >
                <Crown className="w-4 h-4 mr-2 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                Plans
              </Button>
            </Link>
            
            {/* <Link to="/trust">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                aria-label="Trust and security information"
                data-testid="nav-trust"
              >
                <Shield className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" aria-hidden="true" />
                Trust
              </Button>
            </Link> */}
            
            <Link to="/blog">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                aria-label="Legal insights and contract law blog"
                data-testid="nav-blog"
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
                  data-testid="nav-admin"
                >
                  <Settings className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  Admin
                </Button>
              </Link>
            )}
            
            {/* Auth Button */}
            {isCheckingAuth ? (
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                disabled
                aria-label="Checking login status"
                data-testid="auth-loading"
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Loading...
              </Button>
            ) : isLoggedIn ? (
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                aria-label="Logout"
                data-testid="button-logout"
                onClick={handleLogoutClick}
              >
                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                Logout
              </Button>
            ) : (
              <Dialog open={showLogin} onOpenChange={setShowLogin}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="mr-2"
                    aria-label="Login or Subscribe"
                    data-testid="button-login"
                    onClick={handleLoginClick}
                  >
                    Login / Subscribe
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <SubscriptionLogin
                    onSuccess={handleLoginSuccess}
                    onCancel={() => setShowLogin(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
            
            <Link to="/donate">
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                aria-label="Support us with a donation"
                data-testid="nav-donate"
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
              data-testid="theme-toggle"
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

          {/* Mobile Navigation */}
          <nav
            className="md:hidden flex items-center space-x-2"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="flex items-center space-x-2">
              {/* Mobile Auth Button */}
              {isCheckingAuth ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs transition-all duration-200"
                  disabled
                  aria-label="Checking login status"
                  data-testid="auth-loading-mobile"
                >
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" />
                </Button>
              ) : isLoggedIn ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs transition-all duration-200 active:scale-95"
                  aria-label="Logout"
                  data-testid="button-logout-mobile"
                  onClick={handleLogoutClick}
                >
                  <LogOut className="w-3 h-3 mr-1" aria-hidden="true" />
                  Logout
                </Button>
              ) : (
                <Dialog open={showLogin} onOpenChange={setShowLogin}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-9 px-3 text-xs transition-all duration-200 active:scale-95"
                      aria-label="Login or Subscribe"
                      data-testid="button-login-mobile"
                      onClick={handleLoginClick}
                    >
                      Login
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <SubscriptionLogin
                      onSuccess={handleLoginSuccess}
                      onCancel={() => setShowLogin(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
              
              {/* Mobile Menu Sheet */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 transition-all duration-200 active:scale-95"
                    aria-label="Open menu"
                    data-testid="menu-button"
                  >
                    <Menu className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <div className="py-4 space-y-2">
                    <SheetClose asChild>
                      <Link to="/subscription?tab=plans">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                          aria-label="View subscription plans"
                          data-testid="nav-plans-mobile"
                          onClick={handleSubscriptionClick}
                        >
                          <Crown className="w-4 h-4 mr-3 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                          Plans
                        </Button>
                      </Link>
                    </SheetClose>
                    
                    <SheetClose asChild>
                      <Link to="/blog">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                          aria-label="Legal insights and contract law blog"
                          data-testid="nav-blog-mobile"
                        >
                          <BookOpen className="w-4 h-4 mr-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                          Blog
                        </Button>
                      </Link>
                    </SheetClose>
                    
                    {isAdmin && (
                      <SheetClose asChild>
                        <Link to="/admin">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                            aria-label="Admin Dashboard"
                            data-testid="nav-admin-mobile"
                          >
                            <Settings className="w-4 h-4 mr-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                            Admin
                          </Button>
                        </Link>
                      </SheetClose>
                    )}
                    
                    <SheetClose asChild>
                      <Link to="/donate">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-10 transition-all duration-200 active:scale-95"
                          aria-label="Support us with a donation"
                          data-testid="nav-donate-mobile"
                        >
                          <Heart className="w-4 h-4 mr-3 text-red-500 dark:text-red-400" aria-hidden="true" />
                          Donate
                        </Button>
                      </Link>
                    </SheetClose>
                    
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
                      data-testid="theme-toggle-mobile"
                    >
                      {theme === "light" ? (
                        <Moon className="w-4 h-4 mr-3" aria-hidden="true" />
                      ) : (
                        <Sun className="w-4 h-4 mr-3" aria-hidden="true" />
                      )}
                      {theme === "light" ? "Dark Mode" : "Light Mode"}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}