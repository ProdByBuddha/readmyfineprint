import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, TrendingUp, Calendar, CreditCard, Settings, AlertCircle, CheckCircle, LogIn, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Progress component available for future usage metrics display
// import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { StripeWrapper } from '@/components/StripeWrapper';
import { StripeDebug } from '@/components/StripeDebug';
import { SubscriptionLogin } from '@/components/SubscriptionLogin';
import AccountDeletion from '@/components/AccountDeletion';
import DataExportButton from '@/components/DataExportButton';
import { getStoredDeviceFingerprint } from '@/utils/deviceFingerprint';
import { createCustomerPortalSession, reactivateSubscription } from '@/lib/api';
import { safeDispatchEvent } from '@/lib/safeDispatchEvent';
// Temporarily disabled TradeSecretProtection due to interference with app functionality
// import TradeSecretProtection from '@/components/TradeSecretProtection';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { sessionFetch } from '@/lib/sessionManager';

interface SubscriptionData {
  subscription?: {
    id: string;
    stripeSubscriptionId: string;
    status: string;
    currentPeriodEnd: Date;
    billingCycle?: 'monthly' | 'yearly';
    cancelAtPeriodEnd?: boolean;
  };
  tier: {
    id: string;
    name: string;
    model: string;
    monthlyPrice: number;
    yearlyPrice?: number;
    limits: {
      documentsPerMonth: number;
      prioritySupport: boolean;
      advancedAnalysis: boolean;
      apiAccess: boolean;
    };
  };
  usage: {
    documentsAnalyzed: number;
    tokensUsed: number;
    cost: number;
    resetDate: Date;
  };
  canUpgrade: boolean;
  suggestedUpgrade?: {
    id: string;
    name: string;
    monthlyPrice: number;
  };
}

export default function SubscriptionPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  // Enable subscription functionality
  const [showComingSoon] = useState(false);

  // Fetch subscription data with React Query
  const { data: subscriptionData, isLoading: loading, error, refetch } = useQuery<SubscriptionData>({
    queryKey: ['/api/user/subscription'],
    enabled: true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Fetch user data
  const fetchUserData = async () => {
    try {
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
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    // Fetch user data first
    fetchUserData();
    
          // Check if this is a successful subscription return
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const success = urlParams.get('success');
      const email = urlParams.get('email');
      
      if (success === 'true' && sessionId) {
        // This is a successful subscription - get the token and set it as cookie
        handleSuccessfulSubscription(sessionId);
      } else {
        fetchSubscriptionData();
      }
    
    // Check for tab parameter in URL to navigate directly to specific tab
    const tabParam = urlParams.get('tab');
    if (tabParam === 'plans') {
      setActiveTab('plans');
      // Clean up URL by removing tab parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('tab');
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
    }
    
    // If email parameter is provided, automatically navigate to plans section
    if (email && email.includes('@')) {
      setActiveTab('plans');
      // Clean up URL by removing email parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('email');
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
    }
  }, []);

  const handleSuccessfulSubscription = async (sessionId: string) => {
    try {
      // Wait a moment for webhook to process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to get the subscription token (now stored as httpOnly cookie)
      try {
        const tokenResponse = await fetch(`/api/subscription/token/${sessionId}`, {
          credentials: 'include'
        });
        if (tokenResponse.ok) {
          const { success, subscription } = await tokenResponse.json();
          if (success && subscription) {
            // Token is now stored as httpOnly cookie automatically
            // Subscription data will be updated via React Query refetch
            
            // Notify other components of auth state change
            safeDispatchEvent('authStateChanged');
            
            console.log('✅ Subscription token set as httpOnly cookie');
          }
        }
      } catch {
        // No token available yet, fetching subscription data normally
      }
      
      // Fallback to normal subscription fetch
      await fetchSubscriptionData();
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Error handling successful subscription:', error);
      fetchSubscriptionData();
    }
  };

  const handleLoginSuccess = (_token: string, subscription: SubscriptionData) => {
    // Invalidate and refetch subscription data
    queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
    setShowLogin(false);
    setActiveTab('overview');
    // Redirect to home page after successful login
    window.location.href = '/';
  };

  // This function is kept for handling successful subscriptions from Stripe redirects
  const fetchSubscriptionData = () => {
    refetch();
  };

  // CSRF-protected checkout mutation
  const createCheckoutMutation = useMutation({
    mutationFn: async ({ tierId, billingCycle }: { tierId: string; billingCycle: 'monthly' | 'yearly' }) => {
      const response = await sessionFetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tierId,
          billingCycle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.error) {
        throw new Error(data.error);
      }
      // Redirect to Stripe checkout
      window.location.href = data.url;
    },
    onError: (error) => {
      console.error('Error creating checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      window.alert(`Failed to start checkout process: ${errorMessage}. Please try again or contact support.`);
    },
  });

  const handlePlanSelect = async (tierId: string, billingCycle: 'monthly' | 'yearly') => {
    if (tierId === 'free') {
      // Handle downgrade to free tier
      if (subscriptionData?.tier.id !== 'free') {
        await handleDowngradeToFree();
      } else {
        setActiveTab('overview');
      }
      return;
    }

    createCheckoutMutation.mutate({ tierId, billingCycle });
  };

  // CSRF-protected cancellation mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await sessionFetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': getStoredDeviceFingerprint(),
        },
        body: JSON.stringify({
          subscriptionId: subscriptionData?.subscription?.stripeSubscriptionId,
          immediate: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      window.alert(data.message || 'Subscription canceled successfully. You will continue to have access until the end of your billing period.');
      // Invalidate and refetch subscription data
      queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
    },
    onError: (error) => {
      console.error('Error canceling subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      window.alert(`Failed to cancel subscription: ${errorMessage}. Please try again.`);
    },
  });

  const handleCancelSubscription = async () => {
    if (window.confirm('Are you sure you want to cancel your subscription? You will be downgraded to the free plan at the end of your billing period.')) {
      cancelSubscriptionMutation.mutate();
    }
  };

  // CSRF-protected downgrade mutation
  const downgradeToFreeMutation = useMutation({
    mutationFn: async () => {
      const response = await sessionFetch('/api/subscription/downgrade-to-free', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': getStoredDeviceFingerprint(),
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      window.alert(data.message || 'Successfully downgraded to free tier. Your subscription will end at the end of your billing period.');
      // Invalidate and refetch subscription data
      queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
      setActiveTab('overview');
    },
    onError: (error) => {
      console.error('Error downgrading subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      window.alert(`Failed to downgrade subscription: ${errorMessage}. Please try again.`);
    },
  });

  const handleDowngradeToFree = async () => {
    if (window.confirm('Are you sure you want to downgrade to the free plan? Your subscription will be canceled and you will be downgraded at the end of your billing period.')) {
      downgradeToFreeMutation.mutate();
    }
  };

  // CSRF-protected reactivation mutation
  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await sessionFetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': getStoredDeviceFingerprint(),
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      window.alert(data.message || 'Subscription reactivated successfully.');
      // Invalidate and refetch subscription data
      queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
      setActiveTab('overview');
    },
    onError: (error) => {
      console.error('Error reactivating subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      window.alert(`Failed to reactivate subscription: ${errorMessage}. Please try again.`);
    },
  });

  const handleUpdatePaymentMethod = async () => {
    try {
      const { url } = await createCustomerPortalSession();
      window.location.href = url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      window.alert(`Failed to open payment settings: ${errorMessage}. Please try again.`);
    }
  };

  const handleReactivateSubscription = async () => {
    if (window.confirm('Are you sure you want to reactivate your subscription? This will resume your subscription and you will continue to be billed.')) {
      reactivateSubscriptionMutation.mutate();
    }
  };

  // Show coming soon modal in production
  if (showComingSoon) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-4 dark:text-white">Coming Soon</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Subscription management is coming soon! We're working hard to bring you premium features.
              </p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="w-full"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load subscription data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Usage percentage calculation (currently unused but available for future features)
  // const usagePercentage = subscriptionData.tier.limits.documentsPerMonth === -1
  //   ? 0 // Unlimited, so no percentage
  //   : (subscriptionData.usage.documentsAnalyzed / subscriptionData.tier.limits.documentsPerMonth) * 100;

  // Reset date calculation (currently unused but available for billing info)
  // let resetDate: Date;
  // try {
  //   resetDate = subscriptionData.usage.resetDate instanceof Date 
  //     ? subscriptionData.usage.resetDate 
  //     : new Date(subscriptionData.usage.resetDate);

  //   // Check if date is valid
  //   if (isNaN(resetDate.getTime())) {
  //     resetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now as fallback
  //   }
  // } catch {
  //   resetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now as fallback
  // }

  // const daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Temporarily disabled TradeSecretProtection due to interference with app functionality */}
      {/* <TradeSecretProtection /> */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy-First Document Analysis Plans</h1>
              <p className="text-gray-600 dark:text-gray-300">Choose the plan that fits your secure document processing needs</p>
            </div>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full h-auto ${subscriptionData.tier.id === 'free' ? 'grid-cols-2' : 'grid-cols-4'}`}>
            <TabsTrigger value="overview" className="text-sm px-2 py-3 min-h-[44px] flex items-center justify-center">Overview</TabsTrigger>
            <TabsTrigger value="plans" className="text-sm px-2 py-3 min-h-[44px] flex items-center justify-center">Plans</TabsTrigger>
            {subscriptionData.tier.id !== 'free' && (
              <TabsTrigger value="billing" className="text-sm px-2 py-3 min-h-[44px] flex items-center justify-center">Billing</TabsTrigger>
            )}
            {subscriptionData.tier.id !== 'free' && (
              <TabsTrigger value="account" className="text-sm px-2 py-3 min-h-[44px] flex items-center justify-center">Account</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Current Plan */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <span>Current Plan</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold dark:text-white">{subscriptionData.tier.name}</h3>
                      <p className="text-gray-600 dark:text-gray-300">Enterprise-grade security with advanced AI analysis</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold dark:text-white">
                        {subscriptionData.tier.monthlyPrice === 0 ? 'Free' : `$${subscriptionData.tier.monthlyPrice}/month`}
                      </div>
                      {subscriptionData.tier.id !== 'free' && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                  </div>

                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-xl font-semibold">
                          {subscriptionData.tier.limits.documentsPerMonth === -1 ? '∞' : subscriptionData.tier.limits.documentsPerMonth}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Documents/Month</div>
                      </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xl font-semibold">
                        {subscriptionData.tier.id !== 'free' ? <CheckCircle className="h-6 w-6 text-green-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Priority Support</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xl font-semibold">
                        {subscriptionData.tier.limits.advancedAnalysis ? <CheckCircle className="h-6 w-6 text-green-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Privacy-Preserving Analysis</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xl font-semibold">
                        {subscriptionData.tier.limits.apiAccess ? <CheckCircle className="h-6 w-6 text-green-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">API Access</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Data Export Section for Professional+ Tiers */}
            {['professional', 'business', 'enterprise', 'ultimate'].includes(subscriptionData.tier.id) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
                      <Download className="h-5 w-5" />
                      <span>Data Export Available</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-700 dark:text-green-300 mb-2">
                          As a {subscriptionData.tier.name} tier member, you can download all your personal data including usage history and audit trails.
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          This export is GDPR compliant and includes all data we hold about you.
                        </p>
                      </div>
                      <DataExportButton />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Usage Statistics - HIDDEN FOR DEVELOPMENT */}
            {/* 
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <span>Usage This Month</span>
                  </CardTitle>
                  <CardDescription>
                    Resets in {daysUntilReset} days ({resetDate.toLocaleDateString()})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="dark:text-white">Documents Analyzed</span>
                      <span className="font-semibold dark:text-white">
                        {subscriptionData.usage.documentsAnalyzed} / {subscriptionData.tier.limits.documentsPerMonth === -1 ? '∞' : subscriptionData.tier.limits.documentsPerMonth}
                      </span>
                    </div>
                    {subscriptionData.tier.limits.documentsPerMonth === -1 ? (
                      <div className="h-2 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-xs text-green-700 font-medium">Unlimited</span>
                      </div>
                    ) : (
                      <>
                        <Progress value={usagePercentage} className="h-2" />
                        {usagePercentage > 80 && (
                          <p className="text-sm text-orange-600 mt-1">
                            You&apos;re approaching your monthly limit
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <div className="text-xl font-semibold text-blue-600">
                        {subscriptionData.usage.tokensUsed.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Tokens Used</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                      <div className="text-xl font-semibold text-green-600">
                        ${subscriptionData.usage.cost.toFixed(4)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">AI Costs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            */}

            {/* Upgrade Suggestion or Login Option */}
            {subscriptionData.canUpgrade && subscriptionData.suggestedUpgrade && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Alert className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-left space-y-1">
                        <strong className="dark:text-white">Ready to upgrade or already subscribed?</strong>
                        <p className="text-sm mt-1 dark:text-gray-300">
                          Upgrade to {subscriptionData.suggestedUpgrade.name} for advanced privacy protection and enhanced document analysis capabilities.
                        </p>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button
                          variant="outline"
                          onClick={() => setShowLogin(true)}
                          className="whitespace-nowrap text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
                        >
                          Login to Account
                        </Button>
                        <Button
                          onClick={() => setActiveTab('plans')}
                          className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
                        >
                          View Plans
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="plans">
            {/* Login option for existing subscribers */}
            {subscriptionData.tier.id === 'free' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <Alert className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
                  <LogIn className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-left space-y-1">
                        <strong className="dark:text-white">Already have a subscription?</strong>
                        <p className="text-sm mt-1 dark:text-gray-300">
                          If you&apos;ve already subscribed, click here to access your account from this device.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setShowLogin(true)}
                        className="whitespace-nowrap text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
                      >
                        Login to Account
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
            
            {/* Debug component to see what's happening with Stripe - only in development */}
            {import.meta.env.DEV && <StripeDebug />}
            
            <StripeWrapper>
              <SubscriptionPlans
                currentTier={subscriptionData.tier.id}
                cancelAtPeriodEnd={subscriptionData.subscription?.cancelAtPeriodEnd}
                onSelectPlan={handlePlanSelect}
                onReactivate={handleReactivateSubscription}
              />
            </StripeWrapper>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-green-500" />
                  <span>Billing Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptionData.tier.id === 'free' ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No Billing Information</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">You&apos;re currently on the free plan</p>
                    <Button onClick={() => setActiveTab('plans')}>
                      Upgrade to Paid Plan
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!subscriptionData.subscription?.cancelAtPeriodEnd ? (
                      <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <h4 className="font-semibold dark:text-white">Next Billing Date</h4>
                          <p className="text-gray-600 dark:text-gray-300">
                            {subscriptionData.usage.resetDate instanceof Date 
                              ? subscriptionData.usage.resetDate.toLocaleDateString()
                              : new Date(subscriptionData.usage.resetDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold dark:text-white">
                            ${subscriptionData.subscription?.billingCycle === 'yearly' ? 
                              Math.round((subscriptionData.tier.yearlyPrice || subscriptionData.tier.monthlyPrice * 12) / 12) : 
                              subscriptionData.tier.monthlyPrice}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {subscriptionData.subscription?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <h4 className="font-semibold dark:text-white">Access Expires</h4>
                          <p className="text-gray-600 dark:text-gray-300">
                            {subscriptionData.usage.resetDate instanceof Date 
                              ? subscriptionData.usage.resetDate.toLocaleDateString()
                              : new Date(subscriptionData.usage.resetDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                            Cancelled
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            No future billing
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleUpdatePaymentMethod}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Update Payment Method
                      </Button>
                      {!subscriptionData.subscription?.cancelAtPeriodEnd && (
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={handleCancelSubscription}
                        >
                          Cancel Subscription
                        </Button>
                      )}
                      {subscriptionData.subscription?.cancelAtPeriodEnd && (
                        <div className="flex-1 space-y-3">
                          <div className="text-center py-2 px-4 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-md border border-orange-200 dark:border-orange-800">
                            <span className="text-sm font-medium">Subscription Canceled</span>
                            <p className="text-xs mt-1">Access until end of billing period</p>
                          </div>
                          <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleReactivateSubscription}
                          >
                            Reactivate Subscription
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {subscriptionData && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <span className="text-gray-900 dark:text-gray-100">
                            {/* This would need to be passed from user context or fetched */}
                            {user?.email || 'Loading...'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Account Status</label>
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                            Active
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data & Privacy</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Manage your account data and privacy settings. Export your data or delete your account permanently.
                      </p>
                      
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Download Your Data</h4>
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                Export all your personal data, usage history, and audit trails (GDPR compliant).
                              </p>
                            </div>
                            <DataExportButton />
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Delete Account</h4>
                        <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                          Permanently delete your account and all associated data. Financial records will be retained for compliance.
                        </p>
                        <AccountDeletion 
                          userEmail={user?.email || ''} 
                          onSuccess={() => {
                            // Clear any remaining localStorage items and redirect
                            localStorage.removeItem('token');
                            localStorage.removeItem('refreshToken');
                            localStorage.removeItem('user');
                            // Subscription token is now handled via httpOnly cookies
                            window.location.href = '/';
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Subscription Login Modal */}
      {showLogin && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-login-modal"
        >
          <button
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={() => setShowLogin(false)}
            onKeyDown={(e) => e.key === 'Escape' && setShowLogin(false)}
            aria-label="Close modal"
            tabIndex={-1}
          />
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full relative z-10"
            role="document"
          >
            <SubscriptionLogin
              onSuccess={handleLoginSuccess}
              onCancel={() => setShowLogin(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}