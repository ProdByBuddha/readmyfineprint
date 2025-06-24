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
  emailVerified: boolean('email_verified').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tierId: text('tier_id').notNull(),
  status: text('status').notNull(), // 'active', 'canceled', 'past_due', 'incomplete', 'inactive'
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

export const subscriptionTokens = pgTable('subscription_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').unique().notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subscriptionId: uuid('subscription_id').references(() => userSubscriptions.id, { onDelete: 'cascade' }),
  tierId: text('tier_id').notNull(),
  deviceFingerprint: text('device_fingerprint'),
  usageCount: integer('usage_count').default(0).notNull(),
  lastUsed: timestamp('last_used').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailVerificationCodes = pgTable('email_verification_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  deviceFingerprint: text('device_fingerprint').notNull(),
  clientIp: text('client_ip').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailVerificationRateLimit = pgTable('email_verification_rate_limit', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  clientIp: text('client_ip').notNull(),
  attempts: integer('attempts').default(1).notNull(),
  windowStart: timestamp('window_start').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailChangeRequests = pgTable('email_change_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  currentEmail: text('current_email').notNull(),
  newEmail: text('new_email').notNull(),
  reason: text('reason').notNull(),
  clientIp: text('client_ip').notNull(),
  deviceFingerprint: text('device_fingerprint').notNull(),
  userAgent: text('user_agent').notNull(),
  
  // Alternative verification data
  securityAnswers: text('security_answers'), // JSON string of encrypted answers
  
  // Request status and tracking
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected', 'expired'
  adminNotes: text('admin_notes'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  
  // Security and expiration
  verificationCode: text('verification_code'), // For partial email verification if possible
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(userSubscriptions),
  usageRecords: many(usageRecords),
  subscriptionTokens: many(subscriptionTokens),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  usageRecords: many(usageRecords),
  subscriptionTokens: many(subscriptionTokens),
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

export const subscriptionTokensRelations = relations(subscriptionTokens, ({ one }) => ({
  user: one(users, {
    fields: [subscriptionTokens.userId],
    references: [users.id],
  }),
  subscription: one(userSubscriptions, {
    fields: [subscriptionTokens.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

// Insert Schemas
const insertUserSchemaBase = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertUserSubscriptionSchemaBase = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertUsageRecordSchemaBase = createInsertSchema(usageRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertSubscriptionTokenSchemaBase = createInsertSchema(subscriptionTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertEmailVerificationCodeSchemaBase = createInsertSchema(emailVerificationCodes).omit({
  id: true,
  createdAt: true,
});

const insertEmailVerificationRateLimitSchemaBase = createInsertSchema(emailVerificationRateLimit).omit({
  id: true,
  createdAt: true,
});

const insertEmailChangeRequestSchemaBase = createInsertSchema(emailChangeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = insertUserSchemaBase;
export const insertUserSubscriptionSchema = insertUserSubscriptionSchemaBase;
export const insertUsageRecordSchema = insertUsageRecordSchemaBase;
export const insertSubscriptionTokenSchema = insertSubscriptionTokenSchemaBase;
export const insertEmailVerificationCodeSchema = insertEmailVerificationCodeSchemaBase;
export const insertEmailVerificationRateLimitSchema = insertEmailVerificationRateLimitSchemaBase;
export const insertEmailChangeRequestSchema = insertEmailChangeRequestSchemaBase;

// Database Types
export type User = typeof users.$inferSelect;
export type InsertUser = {
  email: string;
  username?: string | null;
  hashedPassword?: string | null;
  stripeCustomerId?: string | null;
};
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = {
  userId: string;
  tierId: string;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
};
export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = {
  userId: string;
  subscriptionId?: string | null;
  period: string;
  documentsAnalyzed?: number;
  tokensUsed?: number;
  cost?: string;
};
export type SubscriptionToken = typeof subscriptionTokens.$inferSelect;
export type InsertSubscriptionToken = {
  token: string;
  userId: string;
  subscriptionId?: string | null;
  tierId: string;
  deviceFingerprint?: string | null;
  usageCount?: number;
  lastUsed?: Date;
  expiresAt: Date;
};

export type EmailChangeRequest = typeof emailChangeRequests.$inferSelect;
export type InsertEmailChangeRequest = {
  userId: string;
  currentEmail: string;
  newEmail: string;
  reason: string;
  clientIp: string;
  deviceFingerprint: string;
  userAgent: string;
  securityAnswers?: string | null;
  status?: string;
  adminNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  verificationCode?: string | null;
  attempts?: number;
  maxAttempts?: number;
  expiresAt: Date;
};

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
  redactionInfo?: PIIRedactionInfo | null;
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

// PII Redaction Interfaces
export interface PIIMatch {
  type: 'ssn' | 'email' | 'phone' | 'creditCard' | 'address' | 'name' | 'dob' | 'custom';
  value: string;
  start: number;
  end: number;
  confidence: number;
  placeholder: string;
}

export interface PIIRedactionInfo {
  hasRedactions: boolean;
  originalContent: string;
  redactedContent: string;
  matches: PIIMatch[];
  redactionMap: Record<string, string>; // placeholder -> original value
  detectionSettings: {
    detectNames: boolean;
    minConfidence: number;
    customPatterns: Array<{
      name: string;
      pattern: string;
      confidence: number;
    }>;
  };
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

// Subscription usage tracking interface
export interface SubscriptionUsage {
  documentsAnalyzed: number;
  tokensUsed: number;
  cost: number;
  resetDate: Date;
}

// Email Recovery and Security Questions
export interface SecurityQuestion {
  id: string;
  question: string;
  required: boolean;
}

export interface SecurityAnswers {
  [questionId: string]: string;
}

export const emailChangeRequestSchema = z.object({
  currentEmail: z.string().email('Invalid current email address'),
  newEmail: z.string().email('Invalid new email address'),
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)').max(500, 'Reason too long'),
  securityAnswers: z.record(z.string()).optional(),
});

export const adminEmailChangeReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNotes: z.string().optional(),
});

export type EmailChangeRequestInput = z.infer<typeof emailChangeRequestSchema>;
export type AdminEmailChangeReview = z.infer<typeof adminEmailChangeReviewSchema>;
