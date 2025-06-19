import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, TrendingUp, Calendar, CreditCard, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { StripeWrapper } from '@/components/StripeWrapper';

interface SubscriptionData {
  tier: {
    id: string;
    name: string;
    model: string;
    monthlyPrice: number;
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
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Show coming soon in production
  const isProduction = import.meta.env.PROD;
  const [showComingSoon, setShowComingSoon] = useState(isProduction);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      // This would be an actual API call
      // const response = await fetch('/api/user/subscription');
      // const data = await response.json();

      // Mock data for demonstration
      const mockData: SubscriptionData = {
        tier: {
          id: 'free',
          name: 'Free',
          model: 'gpt-3.5-turbo',
          monthlyPrice: 0,
          limits: {
            documentsPerMonth: -1, // Unlimited
            prioritySupport: false,
            advancedAnalysis: false,
            apiAccess: false,
          },
        },
        usage: {
          documentsAnalyzed: 47,
          tokensUsed: 164500,
          cost: 0.698125,
          resetDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        },
        canUpgrade: false, // Changed to false since free tier is now unlimited
        suggestedUpgrade: {
          id: 'starter',
          name: 'Starter',
          monthlyPrice: 15,
        },
      };

      setSubscriptionData(mockData);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (tierId: string, billingCycle: 'monthly' | 'yearly') => {
    if (tierId === 'free') {
      setActiveTab('overview');
      return;
    }

    // This would integrate with Stripe checkout
    console.log('Selected plan:', { tierId, billingCycle });
    alert(`Would redirect to Stripe checkout for ${tierId} (${billingCycle})`);
  };

  const handleCancelSubscription = async () => {
    if (confirm('Are you sure you want to cancel your subscription? You will be downgraded to the free plan at the end of your billing period.')) {
      try {
        // await fetch('/api/user/subscription/cancel', { method: 'POST' });
        alert('Subscription canceled successfully');
      } catch (error) {
        console.error('Error canceling subscription:', error);
      }
    }
  };

  // Show coming soon modal in production
  if (showComingSoon) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load subscription data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const usagePercentage = subscriptionData.tier.limits.documentsPerMonth === -1
    ? 0 // Unlimited, so no percentage
    : (subscriptionData.usage.documentsAnalyzed / subscriptionData.tier.limits.documentsPerMonth) * 100;
  const daysUntilReset = Math.ceil((subscriptionData.usage.resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription Management</h1>
          <p className="text-gray-600">Manage your subscription, view usage, and upgrade your plan</p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
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
                      <h3 className="text-xl font-semibold">{subscriptionData.tier.name}</h3>
                      <p className="text-gray-600">Powered by {subscriptionData.tier.model}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
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
                        <div className="text-sm text-gray-600">Documents/Month</div>
                      </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xl font-semibold">
                        {subscriptionData.tier.limits.prioritySupport ? <CheckCircle className="h-6 w-6 text-green-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-sm text-gray-600">Priority Support</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xl font-semibold">
                        {subscriptionData.tier.limits.advancedAnalysis ? <CheckCircle className="h-6 w-6 text-green-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-sm text-gray-600">Advanced Analysis</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-xl font-semibold">
                        {subscriptionData.tier.limits.apiAccess ? <CheckCircle className="h-6 w-6 text-green-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-sm text-gray-600">API Access</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Usage Statistics */}
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
                    Resets in {daysUntilReset} days ({subscriptionData.usage.resetDate.toLocaleDateString()})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Documents Analyzed</span>
                      <span className="font-semibold">
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
                            You're approaching your monthly limit
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-xl font-semibold text-blue-600">
                        {subscriptionData.usage.tokensUsed.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Tokens Used</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-semibold text-green-600">
                        ${subscriptionData.usage.cost.toFixed(4)}
                      </div>
                      <div className="text-sm text-gray-600">AI Costs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upgrade Suggestion */}
            {subscriptionData.canUpgrade && subscriptionData.suggestedUpgrade && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>Consider upgrading to {subscriptionData.suggestedUpgrade.name}</strong>
                        <p className="text-sm mt-1">
                          Get more documents, faster processing, and advanced features for just ${subscriptionData.suggestedUpgrade.monthlyPrice}/month.
                        </p>
                      </div>
                      <Button onClick={() => setActiveTab('plans')}>
                        View Plans
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="plans">
            <StripeWrapper>
              <SubscriptionPlans
                currentTier={subscriptionData.tier.id}
                onSelectPlan={handlePlanSelect}
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
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Billing Information</h3>
                    <p className="text-gray-500 mb-4">You're currently on the free plan</p>
                    <Button onClick={() => setActiveTab('plans')}>
                      Upgrade to Paid Plan
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-semibold">Next Billing Date</h4>
                        <p className="text-gray-600">{subscriptionData.usage.resetDate.toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">${subscriptionData.tier.monthlyPrice}</div>
                        <div className="text-sm text-gray-600">Monthly</div>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <Button variant="outline" className="flex-1">
                        <Settings className="h-4 w-4 mr-2" />
                        Update Payment Method
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleCancelSubscription}
                      >
                        Cancel Subscription
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}