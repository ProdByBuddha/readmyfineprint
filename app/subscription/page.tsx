'use client';

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, TrendingUp, Calendar, CreditCard, Settings, AlertCircle, CheckCircle, LogIn, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MobileAppWrapper } from '@/components/MobileAppWrapper';
import TradeSecretProtection from '@/components/TradeSecretProtection';

interface Tier {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  isPopular: boolean;
  billingCycle: 'monthly' | 'annually';
}

const tiers: Tier[] = [
  {
    id: 'tier-free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    features: [
      'Limited document analysis',
      'Basic contract templates',
      'Community support',
      'Ad-supported',
    ],
    isPopular: false,
    billingCycle: 'monthly',
  },
  {
    id: 'tier-pro-monthly',
    name: 'Pro',
    price: 19.99,
    currency: 'USD',
    features: [
      'Unlimited document analysis',
      'Advanced contract templates',
      'Priority email support',
      'Ad-free experience',
      'Early access to new features',
    ],
    isPopular: true,
    billingCycle: 'monthly',
  },
  {
    id: 'tier-pro-annually',
    name: 'Pro Annual',
    price: 199.99,
    currency: 'USD',
    features: [
      'Unlimited document analysis',
      'Advanced contract templates',
      'Priority email support',
      'Ad-free experience',
      'Early access to new features',
      '2 months free (billed annually)',
    ],
    isPopular: false,
    billingCycle: 'annually',
  },
];

export default function SubscriptionPage() {
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubscribe = async (tierId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Simulate API call to initiate subscription
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, billingCycle: selectedBillingCycle }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Subscription failed');
      }

      const data = await response.json();
      setSuccess(data.message || 'Subscription successful!');
      // In a real app, you'd redirect to a checkout page or update user state
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTiers = tiers.filter(tier => 
    tier.billingCycle === selectedBillingCycle || tier.price === 0
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen page-transition">
      <TradeSecretProtection />
      <MobileAppWrapper>
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Unlock the full power of ReadMyFinePrint with a plan that fits your needs.
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 bg-gray-200 dark:bg-gray-800 rounded-lg">
              <Button
                variant={selectedBillingCycle === 'monthly' ? 'default' : 'ghost'}
                onClick={() => setSelectedBillingCycle('monthly')}
                className="px-6 py-2"
              >
                Monthly
              </Button>
              <Button
                variant={selectedBillingCycle === 'annually' ? 'default' : 'ghost'}
                onClick={() => setSelectedBillingCycle('annually')}
                className="px-6 py-2"
              >
                Annually (Save 17%)
              </Button>
            </div>
          </div>

          {error && <AlertCircle className="text-red-500 mb-4" /> && <p className="text-red-500 text-center mb-4">{error}</p>}
          {success && <CheckCircle className="text-green-500 mb-4" /> && <p className="text-green-500 text-center mb-4">{success}</p>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredTiers.map((tier) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className={`flex flex-col h-full ${tier.isPopular ? 'border-primary-500 ring-2 ring-primary-500' : ''}`}>
                  <CardHeader className="text-center pb-4">
                    {tier.isPopular && (
                      <Badge variant="default" className="mb-2 self-center bg-primary-500 hover:bg-primary-600">
                        Most Popular
                      </Badge>
                    )}
                    <CardTitle className="text-3xl font-bold mb-2">
                      {tier.name}
                    </CardTitle>
                    <div className="text-5xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">
                      ${tier.price === 0 ? '0' : tier.price.toFixed(2)}
                      {tier.price > 0 && <span className="text-lg font-medium text-gray-500 dark:text-gray-400">/{tier.billingCycle === 'monthly' ? 'month' : 'year'}</span>}
                    </div>
                    <CardDescription>
                      {tier.name === 'Free' ? 'Get started with essential features' : 'Everything you need for advanced legal document analysis'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col">
                    <ul className="space-y-3 text-gray-600 dark:text-gray-300 mb-6 flex-grow">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className="w-full mt-auto"
                      onClick={() => handleSubscribe(tier.id)}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : (tier.price === 0 ? 'Get Started' : 'Choose Plan')}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Separator className="my-12" />

          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Frequently Asked Questions</h2>
            <div className="max-w-3xl mx-auto text-left space-y-6">
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-1">What is the difference between Free and Pro?</h3>
                <p className="text-gray-600 dark:text-gray-300">The Free plan offers basic document analysis and limited features, suitable for occasional use. The Pro plan provides unlimited analysis, advanced templates, priority support, and an ad-free experience, designed for frequent or professional users.</p>
              </div>
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-1">Can I change my plan later?</h3>
                <p className="text-gray-600 dark:text-gray-300">Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes will take effect at the start of your next billing cycle.</p>
              </div>
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-1">What payment methods do you accept?</h3>
                <p className="text-gray-600 dark:text-gray-300">We accept all major credit cards, including Visa, MasterCard, American Express, and Discover. All payments are processed securely.</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Is my data secure?</h3>
                <p className="text-gray-600 dark:text-gray-300">Absolutely. We prioritize your data security with end-to-end encryption, regular security audits, and strict privacy policies. We do not store your documents permanently.</p>
              </div>
            </div>
          </div>
        </div>
      </MobileAppWrapper>
    </div>
  );
}
