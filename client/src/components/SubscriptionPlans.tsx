import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Star, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  model: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: {
    documentsPerMonth: number;
    tokensPerDocument: number;
    prioritySupport: boolean;
    advancedAnalysis: boolean;
    apiAccess: boolean;
    customIntegrations: boolean;
  };
  popular?: boolean;
  modelCosts: {
    inputTokenCost: number;
    outputTokenCost: number;
    estimatedTokensPerDocument: number;
    costPerDocument: number;
  };
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for trying out document analysis with basic features",
    model: "gpt-3.5-turbo",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Unlimited document scans",
      "Basic analysis with GPT-3.5-Turbo",
      "Standard processing time",
      "Community support",
      "Basic security features",
      "Essential document insights"
    ],
    limits: {
      documentsPerMonth: -1, // -1 indicates unlimited
      tokensPerDocument: 16000,
      prioritySupport: false,
      advancedAnalysis: false,
      apiAccess: false,
      customIntegrations: false,
    },
    modelCosts: {
      inputTokenCost: 0.50,
      outputTokenCost: 1.50,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.00425,
    }
  },
  {
    id: "starter",
    name: "Starter",
    description: "For individuals and small teams getting started with regular document analysis",
    model: "gpt-4o-mini",
    monthlyPrice: 15,
    yearlyPrice: 150,
    features: [
      "50 document analyses per month",
      "Enhanced analysis with GPT-4o-mini",
      "Faster processing",
      "Email support",
      "Basic integrations",
      "Export to PDF/Word"
    ],
    limits: {
      documentsPerMonth: 50,
      tokensPerDocument: 128000,
      prioritySupport: false,
      advancedAnalysis: true,
      apiAccess: false,
      customIntegrations: false,
    },
    popular: true,
    modelCosts: {
      inputTokenCost: 0.15,
      outputTokenCost: 0.60,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.00135,
    }
  },
  {
    id: "professional",
    name: "Professional",
    description: "For professionals and growing businesses with higher volume needs",
    model: "gpt-4o",
    monthlyPrice: 75,
    yearlyPrice: 750,
    features: [
      "200 document analyses per month",
      "Premium analysis with GPT-4o",
      "Priority processing",
      "Priority email & chat support",
      "Advanced analysis features",
      "API access (100 calls/month)",
      "Custom integrations",
      "Advanced export options",
      "Usage analytics dashboard"
    ],
    limits: {
      documentsPerMonth: 200,
      tokensPerDocument: 128000,
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: true,
      customIntegrations: true,
    },
    modelCosts: {
      inputTokenCost: 2.50,
      outputTokenCost: 10.00,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.02,
    }
  },
  {
    id: "business",
    name: "Business",
    description: "For established businesses with high-volume document processing needs",
    model: "gpt-4-turbo",
    monthlyPrice: 250,
    yearlyPrice: 2500,
    features: [
      "500 document analyses per month",
      "Advanced analysis with GPT-4-Turbo",
      "Fastest processing priority",
      "24/7 priority support",
      "Advanced AI analysis features",
      "Full API access (unlimited)",
      "Custom integrations & webhooks",
      "White-label options",
      "Advanced analytics & reporting",
      "Team collaboration features",
      "SSO integration"
    ],
    limits: {
      documentsPerMonth: 500,
      tokensPerDocument: 128000,
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: true,
      customIntegrations: true,
    },
    modelCosts: {
      inputTokenCost: 10.00,
      outputTokenCost: 30.00,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.065,
    }
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations requiring maximum capability and reasoning power",
    model: "o1-preview",
    monthlyPrice: 500,
    yearlyPrice: 5000,
    features: [
      "1000+ document analyses per month",
      "Most advanced analysis with o1-preview",
      "Maximum reasoning capability",
      "Dedicated account manager",
      "24/7 premium support & SLA",
      "Most advanced AI reasoning",
      "Full API access with higher limits",
      "Custom model fine-tuning options",
      "Complete white-label solution",
      "Advanced security & compliance",
      "Custom deployment options",
      "Training & onboarding",
      "Custom contract terms"
    ],
    limits: {
      documentsPerMonth: 1000,
      tokensPerDocument: 128000,
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: true,
      customIntegrations: true,
    },
    modelCosts: {
      inputTokenCost: 15.00,
      outputTokenCost: 60.00,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.12,
    }
  }
];

interface SubscriptionPlansProps {
  currentTier?: string;
  onSelectPlan: (tierId: string, billingCycle: 'monthly' | 'yearly') => void;
}

const getTierIcon = (tierId: string) => {
  switch (tierId) {
    case 'free': return <Zap className="h-6 w-6" />;
    case 'starter': return <Star className="h-6 w-6" />;
    case 'professional': return <Crown className="h-6 w-6" />;
    case 'business': return <Sparkles className="h-6 w-6" />;
    case 'enterprise': return <AlertTriangle className="h-6 w-6" />;
    default: return <Zap className="h-6 w-6" />;
  }
};

const getTierColor = (tierId: string) => {
  switch (tierId) {
    case 'free': return 'text-gray-600';
    case 'starter': return 'text-blue-600';
    case 'professional': return 'text-purple-600';
    case 'business': return 'text-gold-600';
    case 'enterprise': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

const calculateSavings = (monthlyPrice: number, yearlyPrice: number) => {
  if (monthlyPrice === 0) return 0;
  const annualAtMonthly = monthlyPrice * 12;
  return Math.round(((annualAtMonthly - yearlyPrice) / annualAtMonthly) * 100);
};

export default function SubscriptionPlans({ currentTier, onSelectPlan }: SubscriptionPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isConsidering, setIsConsidering] = useState(false);

  const handleSelectPlan = (tierId: string, billingCycle: 'monthly' | 'yearly') => {
    if (tierId === 'enterprise') {
      setIsConsidering(true); // Show "Coming Soon" popup
    } else {
      onSelectPlan(tierId, billingCycle);
    }
  };

  const handleCloseConsidering = () => {
    setIsConsidering(false);
  };


  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          Powered by different AI models with transparent pricing based on actual AI costs
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <Label htmlFor="billing-toggle" className={billingCycle === 'monthly' ? 'font-semibold' : ''}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <Label htmlFor="billing-toggle" className={billingCycle === 'yearly' ? 'font-semibold' : ''}>
            Yearly
          </Label>
          {billingCycle === 'yearly' && (
            <Badge variant="secondary" className="ml-2">
              Save up to 17%
            </Badge>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {SUBSCRIPTION_TIERS.map((tier, index) => {
          const price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
          const displayPrice = billingCycle === 'yearly' ? price / 12 : price;
          const savings = calculateSavings(tier.monthlyPrice, tier.yearlyPrice);
          const isCurrentTier = currentTier === tier.id;

          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative ${tier.popular ? 'scale-105' : ''}`}
            >
              <Card className={`h-full flex flex-col relative ${
                tier.popular ? 'border-blue-500 border-2 shadow-lg' : 'border-gray-200'
              } ${isCurrentTier ? 'ring-2 ring-green-500' : ''}`}>
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-3 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                {isCurrentTier && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-500 text-white px-3 py-1">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto mb-3 ${getTierColor(tier.id)}`}>
                    {getTierIcon(tier.id)}
                  </div>
                  <CardTitle className="text-xl font-bold">{tier.name}</CardTitle>
                  <CardDescription className="text-sm h-12 flex items-center justify-center">
                    {tier.description}
                  </CardDescription>

                  {/* AI Model Badge */}
                  <Badge variant="outline" className="text-xs">
                    Powered by {tier.model}
                  </Badge>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  {/* Pricing */}
                  <div className="text-center mb-6">
                    {tier.id === 'free' ? (
                      <div className="text-3xl font-bold">Free</div>
                    ) : (
                      <>
                        <div className="text-3xl font-bold">
                          ${displayPrice.toFixed(0)}
                          <span className="text-base font-normal text-gray-600">
                            /month
                          </span>
                        </div>
                        {billingCycle === 'yearly' && savings > 0 && (
                          <div className="text-sm text-green-600 font-medium">
                            Save {savings}% yearly
                          </div>
                        )}
                        {billingCycle === 'yearly' && (
                          <div className="text-xs text-gray-500">
                            ${price} billed annually
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Cost Transparency */}
                  <Alert className="mb-4 bg-gray-50">
                    <AlertDescription className="text-xs">
                      <div>AI Cost: ${tier.modelCosts.costPerDocument.toFixed(4)}/document</div>
                      <div>Our Margin: ~5x (transparent pricing)</div>
                    </AlertDescription>
                  </Alert>

                  {/* Action Button */}
                  <Button
                    className={`w-full ${tier.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    variant={tier.popular ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(tier.id, billingCycle)}
                    disabled={isCurrentTier && tier.id !== 'free'}
                  >
                    {isCurrentTier ? (
                      tier.id === 'free' ? 'Upgrade' : 'Current Plan'
                    ) : tier.id === 'free' ? (
                      'Get Started Free'
                    ) : (
                      `Choose ${tier.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Coming Soon Modal */}
      {isConsidering && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full">
            <div className="text-2xl font-semibold mb-4 dark:text-white">Coming Soon!</div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We're working hard to bring you the Enterprise plan. It will be available soon.
            </p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleCloseConsidering}>
                Okay
              </Button>
            </div>
            <button
                onClick={handleCloseConsidering}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
              >
                <X className="w-5 h-5" />
              </button>
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="mt-12 text-center">
        <Alert className="max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Transparent Pricing:</strong> Our subscription prices are based on actual OpenAI API costs
            with a 5x margin to ensure sustainable service and continuous improvements. Higher tiers use more
            advanced AI models that cost more but provide superior analysis quality.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

import { X } from "lucide-react";