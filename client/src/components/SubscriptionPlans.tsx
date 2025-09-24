import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
  Sparkles,
  Star,
  Target,
  Zap,
  X // Import X icon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from "react-router-dom";
import { MailingListModal } from "@/components/MailingListModal";
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
  iconWrapperClass: string;
}

const DEFAULT_ICON_WRAPPER_CLASS = 'text-gray-600 bg-gray-100 dark:text-gray-100 dark:bg-gray-800/80';

const TIER_ICON_CLASS_MAP: Record<string, string> = {
  free: DEFAULT_ICON_WRAPPER_CLASS,
  starter: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
  professional: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/10',
  business: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  enterprise: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10',
};

export function getTierColor(tierId: string): string {
  try {
    if (Object.prototype.hasOwnProperty.call(TIER_ICON_CLASS_MAP, tierId)) {
      return TIER_ICON_CLASS_MAP[tierId];
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to resolve tier color', tierId, error);
    }
  }

  if (import.meta.env.DEV) {
    console.warn('Unknown tier id when resolving icon color', tierId);
  }

  return DEFAULT_ICON_WRAPPER_CLASS;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for trying out document analysis with basic features",
    model: "gpt-4o-mini",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Analysis with GPT-4o-mini",
      "Standard rate limiting (lower priority)",
      "Email support",
      "Full document insights",
    ],
    limits: {
      documentsPerMonth: 10, // Individual limit for free tier users
      tokensPerDocument: 16000,
      prioritySupport: false,
      advancedAnalysis: false,
      apiAccess: false,
      customIntegrations: false,
    },
    iconWrapperClass: DEFAULT_ICON_WRAPPER_CLASS,
  },
  {
    id: "starter",
    name: "Starter",
    description:
      "For individuals and teams who need faster processing with advanced AI",
    model: "gpt-4.1-mini",
    monthlyPrice: 15,
    yearlyPrice: 150,
    features: [
      "Enhanced analysis with GPT-4.1-mini",
      "Priority rate limiting (faster processing)",
      "Email support",
      "Advanced analysis features",
    ],
    limits: {
      documentsPerMonth: 50, // 50 documents per month
      tokensPerDocument: 128000,
      prioritySupport: false,
      advancedAnalysis: true,
      apiAccess: false,
      customIntegrations: false,
    },
    popular: true,
    iconWrapperClass: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
  },
  {
    id: "professional",
    name: "Professional",
    description:
      "For professionals and growing businesses with higher volume needs",
    model: "gpt-4o",
    monthlyPrice: 75,
    yearlyPrice: 750,
    features: [
      "Premium analysis with GPT-4o",
      "Priority processing",
      "Priority email support",
      "Advanced analysis features",
      "Advanced export options (PDF & Data)",
      "Higher document limits",
    ],
    limits: {
      documentsPerMonth: 200,
      tokensPerDocument: 128000,
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: false,
      customIntegrations: false,
    },
    iconWrapperClass: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/10',
  }
  // Note: Business and Enterprise tiers are temporarily hidden until features are fully implemented
  // Note: Ultimate tier is not displayed in public plans - it's admin-only
];

interface SubscriptionPlansProps {
  currentTier?: string;
  cancelAtPeriodEnd?: boolean;
  onSelectPlan: (tierId: string, billingCycle: "monthly" | "yearly") => void;
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

const calculateSavings = (monthlyPrice: number, yearlyPrice: number) => {
  if (monthlyPrice === 0) return 0;
  const annualAtMonthly = monthlyPrice * 12;
  return Math.round(((annualAtMonthly - yearlyPrice) / annualAtMonthly) * 100);
};

export default function SubscriptionPlans({
  currentTier,
  cancelAtPeriodEnd,
  onSelectPlan,
  onReactivate,
}: SubscriptionPlansProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [showMailingListModal, setShowMailingListModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check if user is logged in to get their email
  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        const response = await fetch("/api/user/profile", {
          credentials: "include",
        });

        if (response.ok) {
          const userData = await response.json();
          if (userData.user?.email) {
            setUserEmail(userData.user.email);
          }
        }
      } catch (error) {
        // User not logged in, continue without email
      }
    };

    checkUserAuth();
  }, []);

  const handleSelectPlan = (
    tierId: string,
    billingCycle: "monthly" | "yearly",
  ) => {
    // All available tiers are ready for selection
    onSelectPlan(tierId, billingCycle);
  };

  const handleNotifyMeClick = () => {
    setShowMailingListModal(true);
  };

  // All tiers are now available for selection
  const availableTiers = SUBSCRIPTION_TIERS;

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600 mb-4">
          All plans include advanced privacy protection
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center space-x-2 mb-4">
          <span
            className={`text-xs ${billingCycle === "monthly" ? "text-gray-900 font-medium" : "text-gray-500"}`}
          >
            Monthly
          </span>
          <button
            onClick={() =>
              setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")
            }
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              billingCycle === "yearly" ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                billingCycle === "yearly" ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-xs ${billingCycle === "yearly" ? "text-gray-900 font-medium" : "text-gray-500"}`}
          >
            Yearly
          </span>
          {billingCycle === "yearly" && (
            <span className="text-xs text-green-600 font-medium ml-1">
              Save up to 17%
            </span>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
        {SUBSCRIPTION_TIERS.map((tier, index) => {
          const price =
            billingCycle === "yearly" ? tier.yearlyPrice : tier.monthlyPrice;
          const displayPrice = billingCycle === "yearly" ? price / 12 : price;
          const savings = calculateSavings(tier.monthlyPrice, tier.yearlyPrice);
          const isCurrentTier = currentTier === tier.id;

          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <Card
                className={`h-full flex flex-col relative min-h-[520px] !overflow-visible hover:shadow-lg transition-all duration-200 ${
                  tier.popular
                    ? 'border-blue-500 border-2 shadow-xl'
                    : 'border-gray-200'
                } ${isCurrentTier
                  ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                    : tier.popular
                      ? 'ring-4 ring-blue-200/80 ring-offset-2 ring-offset-white dark:blue-900/40 dark:ring-offset-slate-950'
                      : ''}`}
              >

                {isCurrentTier && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-green-500 text-white px-3 py-1">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="pt-10 pb-8">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="flex h-8 items-center justify-center" aria-hidden={!tier.popular}>
                      {tier.popular ? (
                        <Badge className="bg-blue-500 text-white px-3 py-1 shadow-sm">
                          Most Popular
                        </Badge>
                      ) : (
                        <span className="h-8" />
                      )}
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${getTierColor(tier.id)}`}
                    >
                      {getTierIcon(tier.id)}
                    </div>
                    <CardTitle className="text-xl font-bold">{tier.name}</CardTitle>
                    <CardDescription className="text-sm min-h-[3rem] flex items-center justify-center px-3 text-center leading-relaxed">
                      {tier.description}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-2 px-6 pb-8">
                  {/* Pricing */}
                  <div className="text-center mb-8">
                    <div className="flex flex-col items-center">
                      {tier.id === "free" ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-3xl font-bold">Free</span>
                          <span className="text-gray-500 text-sm">/month</span>
                        </div>
                      ) : (
                        <div className="text-3xl font-bold">
                          ${displayPrice.toFixed(0)}
                          <span className="text-base font-normal text-gray-600">
                            /month
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col items-center justify-center gap-1 mt-3 min-h-[2.75rem]">
                        <div
                          className={`text-sm font-medium ${
                            billingCycle === "yearly" && tier.id !== "free" && savings > 0
                              ? 'text-green-600'
                              : 'text-transparent'
                          }`}
                          aria-hidden={!(billingCycle === "yearly" && tier.id !== "free" && savings > 0)}
                        >
                          Save {savings}% yearly
                        </div>
                        <div
                          className={`text-xs ${
                            billingCycle === "yearly" && tier.id !== "free"
                              ? 'text-gray-500'
                              : 'text-transparent'
                          }`}
                          aria-hidden={!(billingCycle === "yearly" && tier.id !== "free")}
                        >
                          ${price} billed annually
                        </div>
                      </div>
                    </div>

                    {/* Document Limit & Model Display */}
                    <div className="mt-6 space-y-2">
                      <div className="text-sm font-medium text-gray-700">
                        {tier.limits.documentsPerMonth === -1
                          ? "Unlimited documents"
                          : `${tier.limits.documentsPerMonth} documents/month`}
                      </div>
                      <div className="text-xs text-gray-500">
                        Powered by {tier.model}
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8 flex-1">
                    {tier.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-start space-x-3 text-sm"
                      >
                        <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span className="leading-relaxed text-gray-700">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <div className="mt-auto pt-4">
                    <Button
                      className={`w-full py-4 text-base font-medium ${
                        tier.popular
                          ? "bg-blue-600 hover:bg-blue-700"
                          : isCurrentTier && cancelAtPeriodEnd
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : ""
                      }`}
                      variant={
                        tier.popular
                          ? "default"
                          : isCurrentTier && cancelAtPeriodEnd
                            ? "default"
                            : "outline"
                      }
                      onClick={() => {
                        if (
                          isCurrentTier &&
                          cancelAtPeriodEnd &&
                          onReactivate
                        ) {
                          onReactivate();
                        } else {
                          handleSelectPlan(tier.id, billingCycle);
                        }
                      }}
                      disabled={
                        isCurrentTier &&
                        tier.id !== "free" &&
                        !cancelAtPeriodEnd
                      }
                    >
                      {isCurrentTier && cancelAtPeriodEnd
                        ? "Reactivate Plan"
                        : isCurrentTier
                          ? "Current Plan"
                          : tier.id === "free"
                            ? "Get Started"
                            : `Choose ${tier.name}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Coming Soon Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: SUBSCRIPTION_TIERS.length * 0.1 }}
          className="relative"
        >
          <Card className="h-full flex flex-col relative min-h-[520px] !overflow-visible border-dashed border-2 border-gray-300 bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
            <CardHeader className="items-center text-center pt-10 pb-8 space-y-3">
              <Badge className="bg-orange-500 text-white px-3 py-1 shadow-sm">
                Coming Soon
              </Badge>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500 shadow-sm ring-1 ring-black/5 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-white/10">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <CardTitle className="text-xl font-bold text-gray-600 dark:text-gray-300">
                More Plans
              </CardTitle>
              <CardDescription className="text-sm min-h-[3rem] flex items-center justify-center px-3 text-center leading-relaxed text-gray-500 dark:text-gray-400">
                Enterprise features in development
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col pt-2 px-6 pb-8">
              {/* Pricing */}
              <div className="text-center mb-8">
                <div className="text-3xl font-bold mb-2 text-gray-400 dark:text-gray-500">
                  Coming Soon
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Pricing to be announced
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start space-x-3 text-sm">
                  <div className="h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  </div>
                  <span className="leading-relaxed text-gray-600 dark:text-gray-300">
                    Team collaboration features
                  </span>
                </li>
                <li className="flex items-start space-x-3 text-sm">
                  <div className="h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  </div>
                  <span className="leading-relaxed text-gray-600 dark:text-gray-300">
                    API access & integrations
                  </span>
                </li>
                <li className="flex items-start space-x-3 text-sm">
                  <div className="h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  </div>
                  <span className="leading-relaxed text-gray-600 dark:text-gray-300">
                    SSO integration
                  </span>
                </li>
                <li className="flex items-start space-x-3 text-sm">
                  <div className="h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  </div>
                  <span className="leading-relaxed text-gray-600 dark:text-gray-300">
                    White-label options
                  </span>
                </li>
                <li className="flex items-start space-x-3 text-sm">
                  <div className="h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  </div>
                  <span className="leading-relaxed text-gray-600 dark:text-gray-300">
                    Custom deployment
                  </span>
                </li>
              </ul>

              {/* Action Button */}
              <div className="mt-auto pt-4 space-y-3">
                <Link to="/roadmap">
                  <Button
                    className="w-full items-center justify-center gap-2 py-3 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                    variant="default"
                  >
                    <Target className="h-5 w-5" aria-hidden="true" />
                    <span className="whitespace-nowrap">View Development Roadmap</span>
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </Link>
                <Button
                  className="w-full py-3 text-sm font-medium"
                  variant="outline"
                  onClick={handleNotifyMeClick}
                >
                  Notify Me When Available
                </Button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  See our roadmap for detailed development timeline
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mailing List Modal */}
      <MailingListModal
        isOpen={showMailingListModal}
        onClose={() => setShowMailingListModal(false)}
        subscriptionType="enterprise_features"
        source="subscription_plans"
        userEmail={userEmail || undefined}
      />
    </div>
  );
}