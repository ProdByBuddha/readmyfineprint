import type { SubscriptionTier } from "@shared/schema";

// Current OpenAI API Pricing (September 2025) - Updated Real Models
// GPT-4.1 Nano: $0.08 input, $0.32 output per 1M tokens (fastest & cheapest)
// GPT-4.1 Mini: $0.15 input, $0.60 output per 1M tokens (smaller, faster version of GPT-4.1)
// GPT-4.1: $3.00 input, $10.00 output per 1M tokens (smartest non-reasoning model)
// GPT-5 Nano: $0.50 input, $2.00 output per 1M tokens (fastest, most cost-efficient GPT-5)
// GPT-5 Mini: $5.00 input, $20.00 output per 1M tokens (faster, cost-efficient GPT-5)
// GPT-5: $30.00 input, $120.00 output per 1M tokens (best model for coding and agentic tasks)

/**
 * Calculate cost per document analysis based on:
 * - Average document size: ~2000 input tokens (document content)
 * - Average response size: ~1500 output tokens (analysis)
 * - Total tokens per analysis: ~3500 tokens
 * - Cost calculations include 5x markup for profitability
 */

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for trying out document analysis with basic features",
    model: "gpt-4.1-nano", // Most cost-efficient model available
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Analysis with GPT-4.1 Nano",
      "Fastest processing speed",
      "Email support",
      "Full document insights"
    ],
    limits: {
      documentsPerMonth: 10, // $0.88 cost to provide free tier
      tokensPerDocument: 1000000, // 1M token context window
      prioritySupport: false,
      advancedAnalysis: false,
      apiAccess: false,
      customIntegrations: false,
    },
    modelCosts: {
      inputTokenCost: 0.08,
      outputTokenCost: 0.32,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.00064, // (2000 * 0.08 + 1500 * 0.32) / 1,000,000
    },
    popular: false
  },
  {
    id: "starter",
    name: "Starter",
    description: "For individuals and teams who need enhanced AI with superior performance",
    model: "gpt-4.1-mini", // Smaller, faster version of GPT-4.1
    monthlyPrice: 12, // Optimized pricing: $6.75 cost + 78% margin
    yearlyPrice: 120, // Save $24 per year
    features: [
      "Enhanced analysis with GPT-4.1 Mini",
      "Smaller, faster version of GPT-4.1",
      "High-quality document analysis",
      "Priority processing",
      "Email support"
    ],
    limits: {
      documentsPerMonth: 50, // $6.75 monthly cost to provide
      tokensPerDocument: 1000000, // GPT-4.1-mini 1M context limit
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
    description: "For professionals who need flagship AI with advanced reasoning",
    model: "gpt-4.1", // Smartest non-reasoning model
    monthlyPrice: 49, // $27 cost + 81% margin
    yearlyPrice: 490, // 2 months free
    features: [
      "Premium analysis with GPT-4.1",
      "Smartest non-reasoning model",
      "1M token context window",
      "Priority processing",
      "Priority email & chat support",
      "Advanced analysis features",
      "API access (200 calls/month)",
      "Custom integrations",
      "Advanced export options",
      "Usage analytics dashboard"
    ],
    limits: {
      documentsPerMonth: 200, // $27 monthly cost to provide
      tokensPerDocument: 1000000, // GPT-4.1 context window
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: true,
      customIntegrations: true,
    },
    modelCosts: {
      inputTokenCost: 3.00,
      outputTokenCost: 10.00,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.021, // (2000 * 3.00 + 1500 * 10.00) / 1,000,000
    }
  },
  {
    id: "business",
    name: "Business",
    description: "For businesses requiring advanced GPT-5 capabilities",
    model: "gpt-5-mini", // Faster, cost-efficient version of GPT-5
    monthlyPrice: 199, // $75 cost + 165% margin
    yearlyPrice: 1990, // 2 months free
    features: [
      "Advanced analysis with GPT-5 Mini",
      "Faster, cost-efficient version of GPT-5",
      "Superior performance for well-defined tasks",
      "Fastest processing priority",
      "24/7 priority support",
      "Full API access (unlimited)",
      "Custom integrations & webhooks",
      "White-label options",
      "Advanced analytics & reporting",
      "Team collaboration features",
      "SSO integration"
    ],
    limits: {
      documentsPerMonth: 500, // $75 monthly cost to provide
      tokensPerDocument: 1000000, // GPT-5 Mini context window
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: true,
      customIntegrations: true,
    },
    modelCosts: {
      inputTokenCost: 5.00,
      outputTokenCost: 20.00,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.04, // (2000 * 5.00 + 1500 * 20.00) / 1,000,000
    },
    popular: false
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations requiring the best AI capabilities",
    model: "gpt-5", // The best model for coding and agentic tasks across domains
    monthlyPrice: 999, // $180 cost + 455% margin for enterprise features
    yearlyPrice: 9990, // 2 months free
    features: [
      "Premium analysis with GPT-5",
      "Best model for coding and agentic tasks",
      "Unmatched performance across domains",
      "Dedicated account manager",
      "24/7 premium support & SLA",
      "Full API access with higher limits",
      "Custom model fine-tuning options",
      "Complete white-label solution",
      "Advanced security & compliance",
      "Custom deployment options",
      "Training & onboarding",
      "Custom contract terms"
    ],
    limits: {
      documentsPerMonth: 1000, // $180 monthly cost to provide
      tokensPerDocument: 1000000, // GPT-5 context window
      prioritySupport: true,
      advancedAnalysis: true,
      apiAccess: true,
      customIntegrations: true,
    },
    modelCosts: {
      inputTokenCost: 30.00,
      outputTokenCost: 120.00,
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.24, // (2000 * 30.00 + 1500 * 120.00) / 1,000,000
    },
    popular: false
  },
  {
    id: "ultimate",
    name: "Ultimate",
    description: "Admin-only tier with unlimited access for system administration",
    model: "gpt-5", // Best model for admin use
    monthlyPrice: 0, // No cost for admin tier
    yearlyPrice: 0,
    features: [
      "Unlimited document analysis",
      "Maximum reasoning with o3",
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
      inputTokenCost: 15.00,
      outputTokenCost: 60.00,
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
