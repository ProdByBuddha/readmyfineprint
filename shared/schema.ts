import { z } from "zod";
import { pgTable, text, integer, boolean, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Database Tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  hashedPassword: text('hashed_password'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // Legacy admin field - will be deprecated in favor of roles
  isAdmin: boolean('is_admin').default(false).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  deletionReason: text('deletion_reason'), // 'user_request', 'admin_action', 'compliance'
  suspendedAt: timestamp('suspended_at'), // When user was suspended
  suspensionReason: text('suspension_reason'), // Reason for suspension
  lastLoginAt: timestamp('last_login_at'),
  // 2FA Settings
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  backupEmail: text('backup_email'), // Alternative email for 2FA codes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tierId: text('tier_id').notNull(),
  status: text('status').notNull(), // 'active', 'canceled', 'past_due', 'incomplete', 'inactive', 'payment_failed'
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

export const sessionTokens = pgTable('session_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').unique().notNull(), // Stripe checkout session ID or other session identifier
  token: text('token').notNull(), // The subscription token to map to
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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

export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  consentId: text('consent_id').unique().notNull(), // Original consent ID for backward compatibility
  userPseudonym: text('user_pseudonym').notNull(), // Reproducible pseudonym for the user
  ipHash: text('ip_hash').notNull(), // Hashed IP for analytics
  userAgentHash: text('user_agent_hash').notNull(), // Hashed user agent
  termsVersion: text('terms_version').notNull(),
  verificationToken: text('verification_token').notNull(), // For user to verify their own consent
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  preferenceKey: text('preference_key').notNull(),
  preferenceValue: text('preference_value').notNull(), // JSON string
  preferenceType: text('preference_type').notNull().default('user'), // 'user' or 'system'
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserPreference: { columns: [table.userId, table.preferenceKey] },
}));

// Security Questions Table
export const securityQuestions = pgTable('security_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  question: text('question').notNull(), // Predefined question ID
  answerHash: text('answer_hash').notNull(), // Argon2 hashed answer
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// JWT Token Revocation List - for persistent token revocation across restarts
export const jwtTokenRevocations = pgTable('jwt_token_revocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  jti: text('jti').unique().notNull(), // JWT ID from token
  tokenHash: text('token_hash').unique().notNull(), // SHA-256 hash of full token
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  tokenType: text('token_type').notNull(), // 'access', 'refresh', 'subscription'
  reason: text('reason').notNull(), // Reason for revocation
  revokedBy: text('revoked_by').notNull(), // 'user', 'admin', 'system', 'rotation'
  expiresAt: timestamp('expires_at').notNull(), // When the original token would have expired
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Refresh Tokens - for secure token rotation
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').unique().notNull(), // SHA-256 hash of refresh token
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  deviceFingerprint: text('device_fingerprint'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsed: timestamp('last_used').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// JWT Secret Versions - for secret rotation tracking
export const jwtSecretVersions = pgTable('jwt_secret_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: integer('version').unique().notNull(),
  secretHash: text('secret_hash').notNull(), // SHA-256 hash of secret (for verification only)
  algorithm: text('algorithm').notNull().default('HS256'),
  isActive: boolean('is_active').default(false).notNull(),
  rotatedBy: text('rotated_by').notNull(), // 'system', 'admin', 'auto'
  rotationReason: text('rotation_reason'), // Reason for rotation
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const twoFactorCodes = pgTable('two_factor_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  code: text('code').notNull(), // 6-digit verification code
  type: text('type').notNull(), // 'login', 'enable_2fa', 'disable_2fa'
  email: text('email').notNull(), // Email address where code was sent (primary or backup)
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  isUsed: boolean('is_used').default(false).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const totpSecrets = pgTable('totp_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  encryptedSecret: text('encrypted_secret').notNull(), // Encrypted TOTP secret
  backupCodes: text('backup_codes'), // JSON array of encrypted backup codes
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Mailing List Table
export const mailingList = pgTable('mailing_list', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // Optional - for logged in users
  subscriptionType: text('subscription_type').notNull().default('enterprise_features'), // 'enterprise_features', 'product_updates', 'general'
  source: text('source').notNull().default('subscription_plans'), // 'subscription_plans', 'footer', 'popup', 'manual'
  status: text('status').notNull().default('active'), // 'active', 'unsubscribed', 'bounced'
  ipHash: text('ip_hash'), // Hashed IP for analytics
  userAgentHash: text('user_agent_hash'), // Hashed user agent
  unsubscribeToken: text('unsubscribe_token').unique(), // Unique token for unsubscribe links
  unsubscribedAt: timestamp('unsubscribed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// RBAC (Role-Based Access Control) Tables
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(), // 'admin', 'moderator', 'user', 'guest'
  description: text('description'),
  level: integer('level').notNull(), // Higher number = more permissions (admin=100, user=1)
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(), // 'users.read', 'users.write', 'admin.access'
  description: text('description'),
  resource: text('resource').notNull(), // 'users', 'subscriptions', 'admin'
  action: text('action').notNull(), // 'read', 'write', 'delete', 'access'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: uuid('granted_by').references(() => users.id).notNull(),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  assignedBy: uuid('assigned_by').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at'), // Optional role expiration
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(userSubscriptions),
  usageRecords: many(usageRecords),
  subscriptionTokens: many(subscriptionTokens),
  securityQuestions: many(securityQuestions),
  refreshTokens: many(refreshTokens),
  jwtTokenRevocations: many(jwtTokenRevocations),
  twoFactorCodes: many(twoFactorCodes),
  userRoles: many(userRoles),
  userPreferences: many(userPreferences),
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

export const sessionTokensRelations = relations(sessionTokens, ({ one }) => ({
  user: one(users, {
    fields: [sessionTokens.userId],
    references: [users.id],
  }),
}));

export const securityQuestionsRelations = relations(securityQuestions, ({ one }) => ({
  user: one(users, {
    fields: [securityQuestions.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const jwtTokenRevocationsRelations = relations(jwtTokenRevocations, ({ one }) => ({
  user: one(users, {
    fields: [jwtTokenRevocations.userId],
    references: [users.id],
  }),
}));

export const twoFactorCodesRelations = relations(twoFactorCodes, ({ one }) => ({
  user: one(users, {
    fields: [twoFactorCodes.userId],
    references: [users.id],
  }),
}));

// RBAC Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
  grantedByUser: one(users, {
    fields: [rolePermissions.grantedBy],
    references: [users.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
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

const insertSessionTokenSchemaBase = createInsertSchema(sessionTokens).omit({
  id: true,
  createdAt: true,
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

const insertSecurityQuestionSchemaBase = createInsertSchema(securityQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertRefreshTokenSchemaBase = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertJwtTokenRevocationSchemaBase = createInsertSchema(jwtTokenRevocations).omit({
  id: true,
  createdAt: true,
});

const insertJwtSecretVersionSchemaBase = createInsertSchema(jwtSecretVersions).omit({
  id: true,
  createdAt: true,
});

const insertTwoFactorCodeSchemaBase = createInsertSchema(twoFactorCodes).omit({
  id: true,
  createdAt: true,
});

const insertTotpSecretSchemaBase = createInsertSchema(totpSecrets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertMailingListSchemaBase = createInsertSchema(mailingList).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const insertUserPreferencesSchemaBase = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = insertUserSchemaBase;
export const insertUserSubscriptionSchema = insertUserSubscriptionSchemaBase;
export const insertUsageRecordSchema = insertUsageRecordSchemaBase;
export const insertSubscriptionTokenSchema = insertSubscriptionTokenSchemaBase;
export const insertSessionTokenSchema = insertSessionTokenSchemaBase;
export const insertEmailVerificationCodeSchema = insertEmailVerificationCodeSchemaBase;
export const insertEmailVerificationRateLimitSchema = insertEmailVerificationRateLimitSchemaBase;
export const insertEmailChangeRequestSchema = insertEmailChangeRequestSchemaBase;
export const insertSecurityQuestionSchema = insertSecurityQuestionSchemaBase;
export const insertRefreshTokenSchema = insertRefreshTokenSchemaBase;
export const insertJwtTokenRevocationSchema = insertJwtTokenRevocationSchemaBase;
export const insertJwtSecretVersionSchema = insertJwtSecretVersionSchemaBase;
export const insertTwoFactorCodeSchema = insertTwoFactorCodeSchemaBase;
export const insertTotpSecretSchema = insertTotpSecretSchemaBase;
export const insertMailingListSchema = insertMailingListSchemaBase;
export const insertUserPreferencesSchema = insertUserPreferencesSchemaBase;

// Database Types
export type User = typeof users.$inferSelect;
export type InsertUser = {
  email: string;
  hashedPassword?: string | null;
  stripeCustomerId?: string | null;
  emailVerified?: boolean;
  isActive?: boolean;
  isAdmin?: boolean;
  lastLoginAt?: Date | null;
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

export type SessionToken = typeof sessionTokens.$inferSelect;
export type InsertSessionToken = {
  sessionId: string;
  token: string;
  userId?: string | null;
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

export type SecurityQuestionRecord = typeof securityQuestions.$inferSelect;
export type InsertSecurityQuestion = {
  userId: string;
  question: string;
  answerHash: string;
};

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = {
  tokenHash: string;
  userId: string;
  deviceFingerprint?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isActive?: boolean;
  lastUsed?: Date;
  expiresAt: Date;
};

export type JwtTokenRevocation = typeof jwtTokenRevocations.$inferSelect;
export type InsertJwtTokenRevocation = {
  jti: string;
  tokenHash: string;
  userId?: string | null;
  tokenType: string;
  reason: string;
  revokedBy: string;
  expiresAt: Date;
};

export type JwtSecretVersion = typeof jwtSecretVersions.$inferSelect;
export type InsertJwtSecretVersion = {
  version: number;
  secretHash: string;
  algorithm?: string;
  isActive?: boolean;
  rotatedBy: string;
  rotationReason?: string | null;
  expiresAt: Date;
};

export type TwoFactorCode = typeof twoFactorCodes.$inferSelect;
export type InsertTwoFactorCode = {
  userId: string;
  code: string;
  type: string;
  email: string;
  attempts?: number;
  maxAttempts?: number;
  isUsed?: boolean;
  expiresAt: Date;
};

export type TotpSecret = typeof totpSecrets.$inferSelect;
export type InsertTotpSecret = {
  userId: string;
  encryptedSecret: string;
  backupCodes?: string | null;
  lastUsedAt?: Date | null;
  isActive?: boolean;
};

export type MailingList = typeof mailingList.$inferSelect;
export type InsertMailingList = {
  email: string;
  userId?: string | null;
  subscriptionType?: string;
  source?: string;
  status?: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
  unsubscribeToken?: string | null;
  unsubscribedAt?: Date | null;
};

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = {
  userId: string;
  preferenceKey: string;
  preferenceValue: string;
  preferenceType?: string;
  expiresAt?: Date | null;
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
  type: 'ssn' | 'email' | 'phone' | 'creditCard' | 'address' | 'name' | 'dob' | 'custom' | 'attorney_client';
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
  // Enhanced with Argon2 hashing for secure entanglement
  hashedMatches?: Array<PIIMatch & {
    hashedValue: string;
    entanglementId: string;
  }>;
  piiAnalytics?: {
    documentPIIFingerprint: string;
    piiTypes: Record<string, number>;
    entanglementIds: string[];
    riskScore: number;
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
  adminOnly: z.boolean().optional(), // Flag for admin-only tiers
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

// Security Questions Configuration
// Blog Posts and SEO Tables
export const blogPosts = pgTable('blog_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  content: text('content').notNull(),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  keywords: text('keywords'), // Comma-separated keywords
  category: text('category').notNull().default('contract-law'),
  tags: text('tags'), // JSON array of tags
  status: text('status').notNull().default('draft'), // 'draft', 'published', 'scheduled'
  publishedAt: timestamp('published_at'),
  scheduledFor: timestamp('scheduled_for'),
  authorId: uuid('author_id').references(() => users.id),
  readingTime: integer('reading_time'), // Estimated reading time in minutes
  wordCount: integer('word_count'),
  viewCount: integer('view_count').default(0),
  artificialViewCount: integer('artificial_view_count').default(0),
  shareCount: integer('share_count').default(0),
  artificialShareCount: integer('artificial_share_count').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  canonicalUrl: text('canonical_url'),
  structuredData: text('structured_data'), // JSON-LD structured data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const blogTopics = pgTable('blog_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  difficulty: text('difficulty').notNull().default('beginner'), // 'beginner', 'intermediate', 'advanced'
  keywords: text('keywords'), // Target keywords for SEO
  contentOutline: text('content_outline'), // JSON structure for content sections
  targetAudience: text('target_audience').notNull().default('general'), // 'general', 'legal-professionals', 'business-owners'
  priority: integer('priority').default(0), // Higher number = higher priority
  isUsed: boolean('is_used').default(false).notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contentSimilarity = pgTable('content_similarity', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId1: uuid('post_id_1').references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  postId2: uuid('post_id_2').references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  similarityScore: decimal('similarity_score', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  comparisonMethod: text('comparison_method').notNull().default('semantic'), // 'semantic', 'keyword', 'topic'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const seoMetrics = pgTable('seo_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  targetKeyword: text('target_keyword').notNull(),
  currentRanking: integer('current_ranking'), // Search ranking position
  searchVolume: integer('search_volume'), // Monthly search volume
  difficulty: integer('difficulty'), // SEO difficulty score (1-100)
  clickThroughRate: decimal('click_through_rate', { precision: 5, scale: 4 }), // CTR percentage
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  lastChecked: timestamp('last_checked').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contentGeneration = pgTable('content_generation', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').references(() => blogTopics.id, { onDelete: 'cascade' }).notNull(),
  postId: uuid('post_id').references(() => blogPosts.id, { onDelete: 'cascade' }),
  generatedTitle: text('generated_title').notNull(),
  generatedOutline: text('generated_outline'), // JSON outline
  generatedContent: text('generated_content'),
  aiModel: text('ai_model').notNull().default('gpt-4o'),
  prompt: text('prompt').notNull(),
  tokensUsed: integer('tokens_used'),
  cost: decimal('cost', { precision: 10, scale: 6 }),
  qualityScore: decimal('quality_score', { precision: 3, scale: 2 }), // AI-assessed quality (0-10)
  status: text('status').notNull().default('generated'), // 'generated', 'reviewed', 'approved', 'rejected'
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Blog Relations
export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
  seoMetrics: many(seoMetrics),
  contentGeneration: many(contentGeneration),
}));

export const blogTopicsRelations = relations(blogTopics, ({ many }) => ({
  contentGeneration: many(contentGeneration),
}));

export const contentGenerationRelations = relations(contentGeneration, ({ one }) => ({
  topic: one(blogTopics, {
    fields: [contentGeneration.topicId],
    references: [blogTopics.id],
  }),
  post: one(blogPosts, {
    fields: [contentGeneration.postId],
    references: [blogPosts.id],
  }),
}));

export const seoMetricsRelations = relations(seoMetrics, ({ one }) => ({
  post: one(blogPosts, {
    fields: [seoMetrics.postId],
    references: [blogPosts.id],
  }),
}));

export const SECURITY_QUESTIONS: SecurityQuestion[] = [
  { id: 'childhood_pet', question: 'What was the name of your first pet?', required: false },
  { id: 'childhood_friend', question: 'What was the name of your childhood best friend?', required: false },
  { id: 'birth_city', question: 'In what city were you born?', required: false },
  { id: 'first_school', question: 'What was the name of your elementary school?', required: false },
  { id: 'favorite_teacher', question: 'What was the name of your favorite teacher?', required: false },
  { id: 'first_job', question: 'What was your first job?', required: false },
  { id: 'mothers_maiden', question: "What is your mother's maiden name?", required: false },
  { id: 'first_car', question: 'What was the make and model of your first car?', required: false },
];

export const securityQuestionsSetupSchema = z.object({
  questions: z.array(z.object({
    questionId: z.string(),
    answer: z.string().min(1, 'Answer is required').max(100, 'Answer too long')
  })).min(2, 'Please answer at least 2 security questions').max(4, 'Maximum 4 security questions allowed')
});

export type SecurityQuestionsSetup = z.infer<typeof securityQuestionsSetupSchema>;

// Blog Types
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;
export type BlogTopic = typeof blogTopics.$inferSelect;
export type InsertBlogTopic = typeof blogTopics.$inferInsert;
export type ContentGeneration = typeof contentGeneration.$inferSelect;
export type InsertContentGeneration = typeof contentGeneration.$inferInsert;
export type SeoMetrics = typeof seoMetrics.$inferSelect;
export type InsertSeoMetrics = typeof seoMetrics.$inferInsert;
export type ContentSimilarity = typeof contentSimilarity.$inferSelect;
export type InsertContentSimilarity = typeof contentSimilarity.$inferInsert;

// Blog Schemas
export const blogPostSchema = z.object({
  title: z.string().min(10).max(200),
  excerpt: z.string().min(50).max(300),
  content: z.string().min(500),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.string().optional(),
  category: z.string().default('contract-law'),
  tags: z.string().optional(),
  status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  publishedAt: z.date().optional(),
  scheduledFor: z.date().optional(),
  canonicalUrl: z.string().url().optional(),
});

export const blogTopicSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().optional(),
  category: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  keywords: z.string().optional(),
  targetAudience: z.enum(['general', 'legal-professionals', 'business-owners']).default('general'),
  priority: z.number().default(0),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;
export type BlogTopicInput = z.infer<typeof blogTopicSchema>;

// RLHF (Reinforcement Learning from Human Feedback) Tables for PII Detection Improvement
export const piiDetectionFeedback = pgTable('pii_detection_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionPseudonym: text('session_pseudonym').notNull(), // Anonymous session identifier (not tied to user accounts)
  detectionSessionId: text('detection_session_id').notNull(), // ID of the PII detection session
  
  // Detection details
  detectedText: text('detected_text').notNull(), // The text that was flagged as PII
  detectionType: text('detection_type').notNull(), // 'ssn', 'email', 'phone', 'name', 'address', etc.
  detectionMethod: text('detection_method').notNull(), // 'regex', 'context', 'fuzzy', 'llm', 'composite'
  confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull(), // Original detection confidence (0.00-1.00)
  context: text('context'), // Surrounding text context (anonymized)
  
  // User feedback
  userVote: text('user_vote').notNull(), // 'correct', 'incorrect', 'partially_correct'
  feedbackConfidence: integer('feedback_confidence'), // User's confidence in their feedback (1-5 scale)
  feedbackReason: text('feedback_reason'), // Optional reason for the feedback
  
  // Document context (anonymized)
  documentType: text('document_type'), // 'lease', 'contract', 'legal', 'other'
  documentLength: integer('document_length'), // Character count for context
  
  // Tracking and analytics
  ipHash: text('ip_hash').notNull(), // Hashed IP for abuse prevention
  userAgentHash: text('user_agent_hash').notNull(), // Hashed user agent
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const piiDetectionMetrics = pgTable('pii_detection_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Aggregation period and scope
  period: text('period').notNull(), // 'daily', 'weekly', 'monthly' - for time-based aggregation
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Detection pattern aggregation
  detectionType: text('detection_type').notNull(), // The PII type being measured
  detectionMethod: text('detection_method').notNull(), // The method being measured
  
  // Aggregated metrics
  totalDetections: integer('total_detections').default(0).notNull(),
  totalFeedback: integer('total_feedback').default(0).notNull(),
  correctVotes: integer('correct_votes').default(0).notNull(),
  incorrectVotes: integer('incorrect_votes').default(0).notNull(),
  partiallyCorrectVotes: integer('partially_correct_votes').default(0).notNull(),
  
  // Calculated accuracy metrics
  accuracyRate: decimal('accuracy_rate', { precision: 5, scale: 4 }), // (correct + partial*0.5) / total_feedback
  falsePositiveRate: decimal('false_positive_rate', { precision: 5, scale: 4 }), // incorrect / total_feedback
  confidenceAverage: decimal('confidence_average', { precision: 3, scale: 2 }), // Average detection confidence
  
  // Pattern analysis
  commonFalsePositives: text('common_false_positives'), // JSON array of frequently misdetected patterns
  improvementSuggestions: text('improvement_suggestions'), // JSON array of suggested improvements
  
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const piiDetectionPatterns = pgTable('pii_detection_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Pattern identification
  patternHash: text('pattern_hash').unique().notNull(), // Hash of the pattern for deduplication
  patternType: text('pattern_type').notNull(), // Type of pattern (e.g., 'regex', 'context_rule')
  description: text('description').notNull(), // Human-readable description
  
  // Pattern details
  detectionType: text('detection_type').notNull(), // PII type this pattern detects
  patternContent: text('pattern_content').notNull(), // The actual pattern (regex, rule, etc.)
  confidenceThreshold: decimal('confidence_threshold', { precision: 3, scale: 2 }).notNull(),
  
  // Learning metrics
  totalUses: integer('total_uses').default(0).notNull(),
  correctDetections: integer('correct_detections').default(0).notNull(),
  incorrectDetections: integer('incorrect_detections').default(0).notNull(),
  
  // Status and management
  isActive: boolean('is_active').default(true).notNull(),
  isLearned: boolean('is_learned').default(false).notNull(), // Pattern learned from RLHF feedback
  learningConfidence: decimal('learning_confidence', { precision: 3, scale: 2 }), // Confidence in learned pattern
  
  // Version control
  version: integer('version').default(1).notNull(),
  parentPatternId: uuid('parent_pattern_id'), // Will be setup as foreign key later
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// RLHF Relations
export const piiDetectionFeedbackRelations = relations(piiDetectionFeedback, () => ({
  // No direct relations to users for anonymity
}));

export const piiDetectionMetricsRelations = relations(piiDetectionMetrics, () => ({
  // No direct relations - aggregated data only
}));

export const piiDetectionPatternsRelations = relations(piiDetectionPatterns, ({ one, many }) => ({
  parentPattern: one(piiDetectionPatterns, {
    fields: [piiDetectionPatterns.parentPatternId],
    references: [piiDetectionPatterns.id],
  }),
  childPatterns: many(piiDetectionPatterns),
}));

// RLHF Insert Schemas
const insertPiiDetectionFeedbackSchemaBase = createInsertSchema(piiDetectionFeedback).omit({
  id: true,
  createdAt: true,
});

const insertPiiDetectionMetricsSchemaBase = createInsertSchema(piiDetectionMetrics).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

const insertPiiDetectionPatternsSchemaBase = createInsertSchema(piiDetectionPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPiiDetectionFeedbackSchema = insertPiiDetectionFeedbackSchemaBase;
export const insertPiiDetectionMetricsSchema = insertPiiDetectionMetricsSchemaBase;
export const insertPiiDetectionPatternsSchema = insertPiiDetectionPatternsSchemaBase;

// RLHF Types
export type PiiDetectionFeedback = typeof piiDetectionFeedback.$inferSelect;
export type InsertPiiDetectionFeedback = {
  sessionPseudonym: string;
  detectionSessionId: string;
  detectedText: string;
  detectionType: string;
  detectionMethod: string;
  confidence: string;
  context?: string | null;
  userVote: string;
  feedbackConfidence?: number | null;
  feedbackReason?: string | null;
  documentType?: string | null;
  documentLength?: number | null;
  ipHash: string;
  userAgentHash: string;
};

export type PiiDetectionMetrics = typeof piiDetectionMetrics.$inferSelect;
export type InsertPiiDetectionMetrics = {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  detectionType: string;
  detectionMethod: string;
  totalDetections?: number;
  totalFeedback?: number;
  correctVotes?: number;
  incorrectVotes?: number;
  partiallyCorrectVotes?: number;
  accuracyRate?: string | null;
  falsePositiveRate?: string | null;
  confidenceAverage?: string | null;
  commonFalsePositives?: string | null;
  improvementSuggestions?: string | null;
};

export type PiiDetectionPattern = typeof piiDetectionPatterns.$inferSelect;
export type InsertPiiDetectionPattern = {
  patternHash: string;
  patternType: string;
  description: string;
  detectionType: string;
  patternContent: string;
  confidenceThreshold: string;
  totalUses?: number;
  correctDetections?: number;
  incorrectDetections?: number;
  isActive?: boolean;
  isLearned?: boolean;
  learningConfidence?: string | null;
  version?: number;
  parentPatternId?: string | null;
};

// RLHF Validation Schemas
export const piiDetectionFeedbackSchema = z.object({
  detectionSessionId: z.string().min(1, 'Detection session ID is required'),
  detectedText: z.string().min(1, 'Detected text is required').max(500, 'Detected text too long'),
  detectionType: z.enum(['ssn', 'email', 'phone', 'creditCard', 'address', 'name', 'dob', 'custom', 'attorney_client']),
  detectionMethod: z.enum(['regex', 'context', 'fuzzy', 'composite', 'llm']),
  confidence: z.number().min(0).max(1),
  context: z.string().max(1000).optional(),
  userVote: z.enum(['correct', 'incorrect', 'partially_correct']),
  feedbackConfidence: z.number().min(1).max(5).optional(),
  feedbackReason: z.string().max(500).optional(),
  documentType: z.enum(['lease', 'contract', 'legal', 'other']).optional(),
});

export type PiiDetectionFeedbackInput = z.infer<typeof piiDetectionFeedbackSchema>;

export const insertContentGenerationSchema = createInsertSchema(contentGeneration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

