import type { SubscriptionTier } from "@shared/schema";

// Current OpenAI API Pricing (December 2024)
// GPT-3.5-Turbo: $0.50 input, $1.50 output per 1M tokens
// GPT-4o-mini: $0.15 input, $0.60 output per 1M tokens
// GPT-4o: $2.50 input, $10.00 output per 1M tokens
// GPT-4-Turbo: $10.00 input, $30.00 output per 1M tokens
// o1-preview: $15.00 input, $60.00 output per 1M tokens

/**
 * Calculate cost per document analysis based on:
 * - Average document size: ~2000 input tokens (document content)
 * - Average response size: ~1500 output tokens (analysis)
 * - Total tokens per analysis: ~3500 tokens
 */

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
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
      "Full document insights"
    ],
    limits: {
      documentsPerMonth: 10, // Individual limit for free tier users
      tokensPerDocument: 16000,
      prioritySupport: false,
      advancedAnalysis: false,
      apiAccess: false,
      customIntegrations: false,
    },
    modelCosts: {
      inputTokenCost: 0.15,
      outputTokenCost: 0.60,
      estimatedTokensPerDocument: 2800,
      costPerDocument: 0.00084, // (2000 * 0.15 + 800 * 0.60) / 1,000,000
    },
    popular: false
  },
  {
    id: "starter",
    name: "Starter",
    description: "For individuals and teams who need faster processing with advanced AI",
    model: "gpt-4.1-mini",
    monthlyPrice: 15, // For 50 documents/month with GPT-4.1-mini
    yearlyPrice: 150, // Save $30 per year
    features: [
      "Enhanced analysis with GPT-4.1-mini",
      "Priority rate limiting (faster processing)",
      "Email support"
    ],
    limits: {
      documentsPerMonth: 50, // 50 documents per month
      tokensPerDocument: 128000, // GPT-4.1-mini context limit
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
      costPerDocument: 0.00135, // (2000 * 0.15 + 1500 * 0.60) / 1,000,000
    }
  },
  {
    id: "professional",
    name: "Professional",
    description: "For professionals and growing businesses with higher volume needs",
    model: "gpt-4o",
    monthlyPrice: 75, // 5x profit: ($0.02 * 200 docs * 5) = $0.20, but higher for premium features
    yearlyPrice: 750, // 2 months free
    features: [
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
      costPerDocument: 0.02, // (2000 * 2.50 + 1500 * 10.00) / 1,000,000
    }
  },
  {
    id: "business",
    name: "Business",
    description: "For established businesses with high-volume document processing needs",
    model: "gpt-4-turbo",
    monthlyPrice: 250, // 5x profit on model costs + premium for features
    yearlyPrice: 2500, // 2 months free
    features: [
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
      costPerDocument: 0.065, // (2000 * 10.00 + 1500 * 30.00) / 1,000,000
    }
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations requiring maximum capability and reasoning power",
    model: "o1-preview",
    monthlyPrice: 500, // 5x profit on model costs + premium enterprise features
    yearlyPrice: 5000, // 2 months free
    features: [
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
      costPerDocument: 0.12, // (2000 * 15.00 + 1500 * 60.00) / 1,000,000
    }
  },
  {
    id: "ultimate",
    name: "Ultimate",
    description: "Admin-only tier with unlimited access for system administration",
    model: "gpt-4o",
    monthlyPrice: 0, // No cost for admin tier
    yearlyPrice: 0,
    features: [
      "Unlimited document analysis",
      "All AI models available",
      "System administration access",
      "Complete feature access",
      "Development and testing privileges",
      "Admin dashboard access",
      "Security monitoring tools",
      "User management capabilities"
    ],
    limits: {
      documentsPerMonth: -1, // Unlimited
      tokensPerDocument: -1, // Unlimited
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: true,
      customIntegrations: true,
    },
    modelCosts: {
      inputTokenCost: 2.50,
      outputTokenCost: 10.00,
      estimatedTokensPerDocument: 32000,
      costPerDocument: 0.00, // No cost for admin tier
    },
    popular: false,
    adminOnly: false // Mark as admin-only tier
  }
];

/**
 * Get subscription tier by ID
 */
export function getTierById(id: string): SubscriptionTier | undefined {
  const tier = SUBSCRIPTION_TIERS.find(tier => tier.id === id);
  if (!tier) {
    console.error(`Invalid tier ID requested: ${id}. Available tiers: ${SUBSCRIPTION_TIERS.map(t => t.id).join(', ')}`);
    return undefined;
  }
  return tier;
}

/**
 * Get the default/free tier
 */
export function getFreeTier(): SubscriptionTier {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === "free")!;
}

/**
 * Calculate effective profit margin for a tier
 */
export function calculateProfitMargin(tier: SubscriptionTier): number {
  const monthlyCost = tier.modelCosts.costPerDocument * tier.limits.documentsPerMonth;
  if (monthlyCost === 0) return 0; // Free tier
  return (tier.monthlyPrice - monthlyCost) / monthlyCost;
}

/**
 * Get available upgrade paths for a current tier
 */
export function getUpgradePaths(currentTierId: string): SubscriptionTier[] {
  const currentIndex = SUBSCRIPTION_TIERS.findIndex(tier => tier.id === currentTierId);
  if (currentIndex === -1) return [];

  return SUBSCRIPTION_TIERS.slice(currentIndex + 1);
}

/**
 * Validate if a user can downgrade to a specific tier based on current usage
 */
export function canDowngradeTo(
  currentUsage: { documentsThisMonth: number },
  targetTierId: string
): boolean {
  const targetTier = getTierById(targetTierId);
  if (!targetTier) return false;

  return currentUsage.documentsThisMonth <= targetTier.limits.documentsPerMonth;
}
