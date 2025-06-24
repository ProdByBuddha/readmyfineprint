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
    description: "Perfect for trying out document analysis with unlimited scans",
    model: "gpt-4o-mini",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Unlimited document analysis",
      "Analysis with GPT-4o-mini",
      "Standard rate limiting (lower priority)",
      "Email support",
      "Enterprise-grade security",
      "Full document insights"
    ],
    limits: {
      documentsPerMonth: -1, // -1 indicates unlimited
      tokensPerDocument: 128000, // GPT-4o-mini context limit
      prioritySupport: false,
      advancedAnalysis: false,
      apiAccess: false,
      customIntegrations: false,
    },
    modelCosts: {
      inputTokenCost: 0.50, // per 1M tokens
      outputTokenCost: 1.50, // per 1M tokens
      estimatedTokensPerDocument: 3500,
      costPerDocument: 0.00425, // (2000 * 0.50 + 1500 * 1.50) / 1,000,000
    }
  },
  {
    id: "starter",
    name: "Starter",
    description: "For individuals and teams who need faster processing with advanced AI",
    model: "gpt-4.1-mini",
    monthlyPrice: 15, // For unlimited GPT-4.1-mini with priority processing
    yearlyPrice: 150, // Save $30 per year
    features: [
      "Unlimited document analysis",
      "Enhanced analysis with GPT-4.1-mini",
      "Priority rate limiting (faster processing)",
      "Email support",
      "Enterprise-grade security"
    ],
    limits: {
      documentsPerMonth: -1, // unlimited
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
      costPerDocument: 0.02, // (2000 * 2.50 + 1500 * 10.00) / 1,000,000
    }
  },
  {
    id: "business",
    name: "Business",
    description: "For established businesses with high-volume document processing needs",
    model: "gpt-4-turbo",
    monthlyPrice: 250, // 5x profit: ($0.065 * 500 docs * 5) = $162.50, rounded up for enterprise features
    yearlyPrice: 2500, // 2 months free
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
      costPerDocument: 0.065, // (2000 * 10.00 + 1500 * 30.00) / 1,000,000
    }
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations requiring maximum capability and reasoning power",
    model: "o1-preview",
    monthlyPrice: 500, // 5x profit: ($0.12 * 1000 docs * 5) = $600, but competitive enterprise pricing
    yearlyPrice: 5000, // 2 months free
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
      costPerDocument: 0.12, // (2000 * 15.00 + 1500 * 60.00) / 1,000,000
    }
  },
  {
    id: "ultimate",
    name: "Ultimate",
    description: "God mode - unlimited access to all features",
    model: "gpt-4o",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Unlimited everything",
      "All AI models available",
      "Complete system access",
      "Admin privileges",
      "No restrictions",
      "Development access"
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
      costPerDocument: 0.00, // No cost for ultimate tier
    },
    popular: false
  }
];

/**
 * Get subscription tier by ID
 */
export function getTierById(tierId: string): SubscriptionTier | undefined {
  const tier = SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
  if (!tier && tierId === 'ultimate') {
    console.error(`Ultimate tier not found in SUBSCRIPTION_TIERS. Available tiers: ${SUBSCRIPTION_TIERS.map(t => t.id).join(', ')}`);
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
