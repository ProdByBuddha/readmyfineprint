import { z } from "zod";
import { pgTable, text, integer, boolean, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Database Tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  username: text('username').unique(),
  hashedPassword: text('hashed_password'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tierId: text('tier_id').notNull(),
  status: text('status').notNull(), // 'active', 'canceled', 'past_due', 'incomplete'
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subscriptionId: uuid('subscription_id').references(() => userSubscriptions.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // YYYY-MM format
  documentsAnalyzed: integer('documents_analyzed').default(0).notNull(),
  tokensUsed: integer('tokens_used').default(0).notNull(),
  cost: decimal('cost', { precision: 10, scale: 6 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(userSubscriptions),
  usageRecords: many(usageRecords),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  usageRecords: many(usageRecords),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
  subscription: one(userSubscriptions, {
    fields: [usageRecords.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Database Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;

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
  model: z.enum(['gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-preview']),
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

export const SubscriptionUpgradeSchema = z.object({
  currentTier: z.string(),
  targetTier: z.string(),
  immediate: z.boolean().default(false),
});

export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;
export type SubscriptionUpgrade = z.infer<typeof SubscriptionUpgradeSchema>;
