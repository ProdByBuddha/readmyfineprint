import { z } from "zod";

// Remove database table definitions since we're going session-based
// Keep only the TypeScript interfaces and schemas we need

export const insertDocumentSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
  fileType: z.string().optional(),
  analysis: z.any().optional(),
});

export const consentSchema = z.object({
  disclaimerAccepted: z.boolean(),
  acceptedAt: z.date(),
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Consent = z.infer<typeof consentSchema>;

export interface Document {
  id: number;
  title: string;
  content: string;
  fileType?: string | null;
  analysis?: DocumentAnalysis | null;
  createdAt: Date;
}

export interface DocumentAnalysis {
  summary: string;
  overallRisk: 'low' | 'moderate' | 'high';
  keyFindings: {
    goodTerms: string[];
    reviewNeeded: string[];
    redFlags: string[];
  };
  sections: Array<{
    title: string;
    riskLevel: 'low' | 'moderate' | 'high';
    summary: string;
    concerns?: string[];
  }>;
}

// Subscription and Pricing Schemas
export const SubscriptionTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  model: z.enum(['gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-preview']),
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0),
  features: z.array(z.string()),
  limits: z.object({
    documentsPerMonth: z.number(),
    tokensPerDocument: z.number(),
    prioritySupport: z.boolean(),
    advancedAnalysis: z.boolean(),
    apiAccess: z.boolean(),
    customIntegrations: z.boolean(),
  }),
  popular: z.boolean().optional(),
  modelCosts: z.object({
    inputTokenCost: z.number(), // Cost per 1M tokens in USD
    outputTokenCost: z.number(), // Cost per 1M tokens in USD
    estimatedTokensPerDocument: z.number(),
    costPerDocument: z.number(), // Calculated cost per document analysis
  })
});

export const UserSubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tierId: z.string(),
  status: z.enum(['active', 'canceled', 'past_due', 'incomplete']),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UsageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  subscriptionId: z.string(),
  period: z.string(), // YYYY-MM format
  documentsAnalyzed: z.number(),
  tokensUsed: z.number(),
  cost: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SubscriptionUpgradeSchema = z.object({
  currentTier: z.string(),
  targetTier: z.string(),
  immediate: z.boolean().default(false),
});

export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;
export type UserSubscription = z.infer<typeof UserSubscriptionSchema>;
export type Usage = z.infer<typeof UsageSchema>;
export type SubscriptionUpgrade = z.infer<typeof SubscriptionUpgradeSchema>;
