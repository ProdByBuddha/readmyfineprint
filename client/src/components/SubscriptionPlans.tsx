import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Star, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Alert components available if needed for future features
// import { Alert, AlertDescription } from '@/components/ui/alert';


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
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for secure document analysis with enterprise-grade privacy protection",
    model: "gpt-4o-mini",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Unlimited document analysis",
      "Analysis with GPT-4o-mini",
      "Standard rate limiting (lower priority)",
      "Email support",
      "Military-grade privacy protection",
      "Complete audit trails"
    ],
    limits: {
      documentsPerMonth: -1, // -1 indicates unlimited
      tokensPerDocument: 16000,
      prioritySupport: false,
      advancedAnalysis: false,
      apiAccess: false,
      customIntegrations: false,
    }
  },
  {
    id: "starter",
    name: "Starter",
    description: "For professionals requiring enhanced privacy features and priority processing",
    model: "gpt-4.1-mini",
    monthlyPrice: 15,
    yearlyPrice: 150,
    features: [
      "Unlimited document analysis",
      "Advanced privacy-preserving analysis",
      "Priority processing with enhanced security",
      "Email support",
      "Advanced confidentiality features"
    ],
    limits: {
      documentsPerMonth: -1, // unlimited
      tokensPerDocument: 128000,
      prioritySupport: false,
      advancedAnalysis: true,
      apiAccess: false,
      customIntegrations: false,
    },
    popular: true
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
    }
  }
  // Note: Ultimate tier is not displayed in public plans - it's admin-only
];

interface SubscriptionPlansProps {
  currentTier?: string;
  cancelAtPeriodEnd?: boolean;
  onSelectPlan: (tierId: string, billingCycle: 'monthly' | 'yearly') => void;
  onReactivate?: () => void;
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

export default function SubscriptionPlans({ currentTier, cancelAtPeriodEnd, onSelectPlan, onReactivate }: SubscriptionPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelectPlan = (tierId: string, billingCycle: 'monthly' | 'yearly') => {
    // All available tiers are ready for selection
    onSelectPlan(tierId, billingCycle);
  };



  // Filter to show only available tiers (free and starter for now)
  const availableTiers = SUBSCRIPTION_TIERS.filter(tier => 
    tier.id === 'free' || tier.id === 'starter'
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-2">
      <div className="text-center mb-3">
        <p className="text-sm text-gray-600 mb-2">
          All plans include enterprise-grade security and advanced privacy protection
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center space-x-1 mb-3">
          <span className={`text-xs ${billingCycle === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              billingCycle === 'yearly' ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-xs ${billingCycle === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <span className="text-xs text-green-600 font-medium ml-1">Save up to 17%</span>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {availableTiers.map((tier, index) => {
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

                <CardHeader className="text-center pb-1 pt-3">
                  <div className={`mx-auto mb-1 ${getTierColor(tier.id)}`}>
                    {getTierIcon(tier.id)}
                  </div>
                  <CardTitle className="text-base font-bold">{tier.name}</CardTitle>
                  <CardDescription className="text-xs h-8 flex items-center justify-center">
                    {tier.description}
                  </CardDescription>

                  {/* Security Badge */}
                  <Badge variant="outline" className="text-xs mt-0.5">
                    Enterprise Security
                  </Badge>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-1 px-4 pb-4">
                  {/* Pricing */}
                  <div className="text-center mb-3">
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
                  <ul className="space-y-1 mb-3 flex-1">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-xs">
                        <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>


                  {/* Action Button */}
                  {!(tier.id === 'free' && currentTier === 'free') && !(tier.id === 'free' && cancelAtPeriodEnd) && (
                    <Button
                      className={`w-full ${
                        tier.popular ? 'bg-blue-600 hover:bg-blue-700' : 
                        (isCurrentTier && cancelAtPeriodEnd) ? 'bg-green-600 hover:bg-green-700 text-white' : ''
                      }`}
                      variant={tier.popular ? 'default' : (isCurrentTier && cancelAtPeriodEnd) ? 'default' : 'outline'}
                      onClick={() => {
                        if (isCurrentTier && cancelAtPeriodEnd && onReactivate) {
                          onReactivate();
                        } else {
                          handleSelectPlan(tier.id, billingCycle);
                        }
                      }}
                      disabled={isCurrentTier && tier.id !== 'free' && !cancelAtPeriodEnd}
                    >
                      {isCurrentTier && cancelAtPeriodEnd ? (
                        'Reactivate Plan'
                      ) : isCurrentTier ? (
                        'Current Plan'
                      ) : tier.id === 'free' ? (
                        'Downgrade'
                      ) : (
                        `Choose ${tier.name}`
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}