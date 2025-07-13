import { type User, type UserSubscription, type UsageRecord, type EmailChangeRequest, type InsertUser, type InsertUserSubscription, type InsertUsageRecord, type InsertEmailChangeRequest } from "@shared/schema";
import { and, eq, desc, lt, sql } from "drizzle-orm";
import { type Document, type InsertDocument } from "@shared/schema";
import { type IStorage } from "./storage";

// Import database conditionally
let db: any;
let users: any;
let userSubscriptions: any;
let usageRecords: any;
let emailChangeRequests: any;

// Initialize database connection based on validation mode
async function initializeDatabase() {
  if (process.env.VALIDATION_MODE === 'true') {
    // Create mock database objects for validation mode
    console.log('🔄 DatabaseStorage: Running in validation mode with mock database');
    db = {
      select: (fields?: any) => ({
        from: (table: any) => ({
          where: (condition: any) => ({
            orderBy: (order: any) => ({
              limit: (count: any) => Promise.resolve([])
            }),
            limit: (count: any) => Promise.resolve([])
          }),
          orderBy: (order: any) => ({
            limit: (count: any) => Promise.resolve([])
          }),
          limit: (count: any) => Promise.resolve([])
        })
      }),
      insert: (table: any) => ({
        values: (data: any) => ({
          returning: () => Promise.resolve([{ id: 'mock-id' }])
        })
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: (condition: any) => Promise.resolve([])
        })
      }),
      delete: (table: any) => ({
        where: (condition: any) => Promise.resolve()
      }),
      execute: (query: any) => Promise.resolve([])
    };
    
    users = {};
    userSubscriptions = {};
    usageRecords = {};
    emailChangeRequests = {};
  } else {
    // Import real database modules
    const dbModule = await import('./db');
    db = dbModule.db;
    
    const schemaModule = await import('@shared/schema');
    users = schemaModule.users;
    userSubscriptions = schemaModule.userSubscriptions;
    usageRecords = schemaModule.usageRecords;
    emailChangeRequests = schemaModule.emailChangeRequests;
  }
}

export class DatabaseStorage implements IStorage {
  // Document management (keeping session-based for now)
  private sessions: Map<string, { documents: Map<number, Document>; currentDocumentId: number; lastAccessed: Date }> = new Map();
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private clientSessions: Map<string, Set<string>> = new Map();
  private initialized = false;

  constructor() {
    // Initialize database connection asynchronously
    this.initializeAsync();
    
    // Clean up expired sessions every 10 minutes
    setInterval(() => this.clearExpiredSessions(), 10 * 60 * 1000);
  }

  private async initializeAsync() {
    if (!this.initialized) {
      await initializeDatabase();
      this.initialized = true;
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeAsync();
    }
  }

  // Document methods (session-based)
  async createDocument(sessionId: string, insertDocument: InsertDocument, clientFingerprint?: string): Promise<Document> {
    const session = this.getOrCreateSession(sessionId, clientFingerprint);
    const id = session.currentDocumentId++;
    const document: Document = {
      ...insertDocument,
      id,
      title: insertDocument.title || "Untitled Document",
      createdAt: new Date()
    };
    session.documents.set(id, document);
    return document;
  }

  async getDocument(sessionId: string, id: number, clientFingerprint?: string): Promise<Document | undefined> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date();
      return session.documents.get(id);
    }
    return undefined;
  }

  async getAllDocuments(sessionId: string): Promise<Document[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    
    session.lastAccessed = new Date();
    return Array.from(session.documents.values());
  }

  async updateDocumentAnalysis(sessionId: string, id: number, analysis: any, clientFingerprint?: string): Promise<Document | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const document = session.documents.get(id);
    if (document) {
      const updatedDocument = { ...document, analysis };
      session.documents.set(id, updatedDocument);
      session.lastAccessed = new Date();
      return updatedDocument;
    }
    return undefined;
  }

  async clearAllDocuments(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.documents.clear();
      session.currentDocumentId = 1;
      session.lastAccessed = new Date();
    }
  }

  async clearExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (now.getTime() - session.lastAccessed.getTime() > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
      console.log(`Cleared expired database session: ${sessionId}`);
    });
  }

  getAllSessions(): Map<string, { documents: Map<number, Document>; currentDocumentId: number; lastAccessed: Date }> {
    return this.sessions;
  }

  // User management methods
  async getUser(id: string): Promise<User | undefined> {
    await this.ensureInitialized();
    if (process.env.VALIDATION_MODE === 'true') return undefined;
    
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureInitialized();
    if (process.env.VALIDATION_MODE === 'true') return undefined;
    
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ensureInitialized();
    if (process.env.VALIDATION_MODE === 'true') {
      return { id: 'mock-user-id', email: insertUser.email, createdAt: new Date(), updatedAt: new Date() } as User;
    }
    
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createUserWithId(id: string, insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id,
        ...insertUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async userExists(userId: string): Promise<boolean> {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return !!user;
  }

  // Subscription management methods
  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    await this.ensureInitialized();
    if (process.env.VALIDATION_MODE === 'true') return undefined;
    
    const result = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);
    return result[0];
  }

  async getAllUserSubscriptions(): Promise<UserSubscription[]> {
    const subscriptions = await db
      .select()
      .from(userSubscriptions)
      .orderBy(desc(userSubscriptions.createdAt));
    return subscriptions;
  }

  async createUserSubscription(insertSubscription: InsertUserSubscription): Promise<UserSubscription> {
    const [subscription] = await db
      .insert(userSubscriptions)
      .values({
        ...insertSubscription,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Sync Stripe customer ID to user table if provided
    if (subscription && subscription.stripeCustomerId && subscription.userId) {
      await this.syncUserStripeCustomerId(subscription.userId, subscription.stripeCustomerId);
    }

    return subscription;
  }

  /**
   * Sync Stripe customer ID from subscription to user table
   */
  async syncUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    try {
      // Only update if the user doesn't already have a Stripe customer ID or it's different
      const user = await this.getUser(userId);
      if (!user) {
        console.warn(`User ${userId} not found for Stripe customer ID sync`);
        return;
      }

      if (user.stripeCustomerId !== stripeCustomerId) {
        await db
          .update(users)
          .set({ 
            stripeCustomerId,
            updatedAt: new Date() 
          })
          .where(eq(users.id, userId));
        
        console.log(`✅ Synced Stripe customer ID ${stripeCustomerId} to user ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to sync Stripe customer ID for user ${userId}:`, error);
      // Don't throw - this is a secondary operation that shouldn't fail subscription creation
    }
  }

  /**
   * Verify and fix any Stripe customer ID inconsistencies between users and subscriptions
   * Returns a report of any issues found and fixed
   */
  async verifyStripeCustomerIdConsistency(): Promise<{
    consistent: number;
    fixed: number;
    errors: string[];
  }> {
    const report = { consistent: 0, fixed: 0, errors: [] as string[] };
    
    try {
      // Get all subscriptions with Stripe customer IDs
      const subscriptions = await this.getAllUserSubscriptions();
      const subscriptionsWithStripe = subscriptions.filter(sub => sub.stripeCustomerId);
      
      for (const subscription of subscriptionsWithStripe) {
        try {
          const user = await this.getUser(subscription.userId);
          
          if (!user) {
            report.errors.push(`User ${subscription.userId} not found for subscription ${subscription.id}`);
            continue;
          }
          
          if (user.stripeCustomerId === subscription.stripeCustomerId) {
            report.consistent++;
          } else {
            // Fix the inconsistency
            await this.syncUserStripeCustomerId(subscription.userId, subscription.stripeCustomerId!);
            report.fixed++;
          }
        } catch (error) {
          report.errors.push(`Error processing subscription ${subscription.id}: ${error}`);
        }
      }
    } catch (error) {
      report.errors.push(`Failed to verify consistency: ${error}`);
    }
    
    return report;
  }

  async updateUserSubscription(id: string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .update(userSubscriptions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, id))
      .returning();

    // Sync Stripe customer ID to user table if updated
    if (subscription && updates.stripeCustomerId && subscription.userId) {
      await this.syncUserStripeCustomerId(subscription.userId, updates.stripeCustomerId);
    }

    return subscription || undefined;
  }

  async cancelUserSubscription(id: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .update(userSubscriptions)
      .set({
        status: 'canceled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, id))
      .returning();
    return subscription || undefined;
  }

  // Usage tracking methods
  async getUserUsage(userId: string, period: string): Promise<UsageRecord | undefined> {
    const [usage] = await db
      .select()
      .from(usageRecords)
      .where(and(
        eq(usageRecords.userId, userId),
        eq(usageRecords.period, period)
      ));
    return usage || undefined;
  }

  async createUsageRecord(insertUsage: InsertUsageRecord): Promise<UsageRecord> {
    const [usage] = await db
      .insert(usageRecords)
      .values({
        ...insertUsage,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return usage;
  }

  async updateUsageRecord(id: string, updates: Partial<InsertUsageRecord>): Promise<UsageRecord | undefined> {
    const [usage] = await db
      .update(usageRecords)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(usageRecords.id, id))
      .returning();
    return usage || undefined;
  }

  async getUserUsageHistory(userId: string, limit: number = 12): Promise<UsageRecord[]> {
    const history = await db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.userId, userId))
      .orderBy(desc(usageRecords.period))
      .limit(limit);
    return history;
  }

  // Helper methods
  private getOrCreateSession(sessionId: string, clientFingerprint?: string) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        documents: new Map(),
        currentDocumentId: 1,
        lastAccessed: new Date()
      };
      this.sessions.set(sessionId, session);

      if (clientFingerprint) {
        this.associateSessionWithClient(sessionId, clientFingerprint);
      }
    } else {
      session.lastAccessed = new Date();
    }
    return session;
  }

  private associateSessionWithClient(sessionId: string, clientFingerprint: string): void {
    if (!this.clientSessions.has(clientFingerprint)) {
      this.clientSessions.set(clientFingerprint, new Set());
    }
    this.clientSessions.get(clientFingerprint)!.add(sessionId);
  }

  // Email Change Request methods
  async createEmailChangeRequest(request: InsertEmailChangeRequest): Promise<EmailChangeRequest> {
    const [emailChangeRequest] = await db
      .insert(emailChangeRequests)
      .values({
        ...request,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return emailChangeRequest;
  }

  async getEmailChangeRequest(requestId: string): Promise<EmailChangeRequest | undefined> {
    const [request] = await db
      .select()
      .from(emailChangeRequests)
      .where(eq(emailChangeRequests.id, requestId));
    return request || undefined;
  }

  async getUserPendingEmailChangeRequests(userId: string): Promise<EmailChangeRequest[]> {
    const requests = await db
      .select()
      .from(emailChangeRequests)
      .where(and(
        eq(emailChangeRequests.userId, userId),
        eq(emailChangeRequests.status, 'pending')
      ))
      .orderBy(desc(emailChangeRequests.createdAt));
    return requests;
  }

  async getPendingEmailChangeRequests(limit: number = 50): Promise<EmailChangeRequest[]> {
    const requests = await db
      .select()
      .from(emailChangeRequests)
      .where(eq(emailChangeRequests.status, 'pending'))
      .orderBy(desc(emailChangeRequests.createdAt))
      .limit(limit);
    return requests;
  }

  async updateEmailChangeRequestStatus(
    requestId: string, 
    status: string, 
    adminNotes?: string
  ): Promise<EmailChangeRequest | undefined> {
    const [request] = await db
      .update(emailChangeRequests)
      .set({
        status,
        adminNotes,
        updatedAt: new Date(),
      })
      .where(eq(emailChangeRequests.id, requestId))
      .returning();
    return request || undefined;
  }

  async reviewEmailChangeRequest(
    requestId: string,
    adminUserId: string,
    status: string,
    adminNotes?: string
  ): Promise<EmailChangeRequest | undefined> {
    const [request] = await db
      .update(emailChangeRequests)
      .set({
        status,
        adminNotes,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailChangeRequests.id, requestId))
      .returning();
    return request || undefined;
  }

  async incrementEmailChangeRequestAttempts(requestId: string): Promise<EmailChangeRequest | undefined> {
    const [request] = await db
      .update(emailChangeRequests)
      .set({
        attempts: sql`${emailChangeRequests.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(emailChangeRequests.id, requestId))
      .returning();
    return request || undefined;
  }

  async markExpiredEmailChangeRequests(): Promise<number> {
    const results = await db
      .update(emailChangeRequests)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(and(
        eq(emailChangeRequests.status, 'pending'),
        lt(emailChangeRequests.expiresAt, new Date())
      ))
      .returning();
    return results.length;
  }

  // Admin Dashboard Methods
  async getTotalUserCount(): Promise<number> {
    await this.ensureInitialized();
    if (process.env.VALIDATION_MODE === 'true') return 0;
    
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return result[0]?.count || 0;
  }

  async getActiveSubscriptionCount(): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.status, 'active'));
    return parseInt(result[0].count as string);
  }

  async getUserCountSince(date: Date): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(sql`${users.createdAt} >= ${date.toISOString()}`);
    return parseInt(result[0].count as string);
  }

  async getSubscriptionCountSince(date: Date): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.status, 'active'),
        sql`${userSubscriptions.createdAt} >= ${date.toISOString()}`
      ));
    return parseInt(result[0].count as string);
  }

  async getDocumentAnalysisCountSince(date: Date): Promise<number> {
    // Since documents are session-based, we'll estimate from usage records
    const result = await db
      .select({ total: sql`sum(${usageRecords.documentsAnalyzed})` })
      .from(usageRecords)
      .where(sql`${usageRecords.createdAt} >= ${date.toISOString()}`);
    return parseInt(result[0].total as string) || 0;
  }

  async getUsers(options: {
    page: number;
    limit: number;
    search?: string;
    sortBy: string;
    sortOrder: string;
    hasSubscription?: boolean;
  }): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (options.page - 1) * options.limit;
    
    // Build query conditions
    let conditions = sql`1=1`;
    
    if (options.search) {
      const searchTerm = `%${options.search}%`;
      conditions = sql`${users.email} ILIKE ${searchTerm}`;
    }

    if (options.hasSubscription !== undefined) {
      if (options.hasSubscription) {
        conditions = sql`${conditions} AND EXISTS (
          SELECT 1 FROM ${userSubscriptions} 
          WHERE ${userSubscriptions.userId} = ${users.id} 
          AND ${userSubscriptions.status} = 'active'
        )`;
      } else {
        conditions = sql`${conditions} AND NOT EXISTS (
          SELECT 1 FROM ${userSubscriptions} 
          WHERE ${userSubscriptions.userId} = ${users.id} 
          AND ${userSubscriptions.status} = 'active'
        )`;
      }
    }

    // Get total count
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(conditions);
    const total = parseInt(totalResult[0].count as string);

    // Get users with sorting
    const orderColumn = options.sortBy === 'email' ? users.email : users.createdAt;
    const orderDirection = options.sortOrder === 'asc' ? sql`ASC` : sql`DESC`;
    
    const userResults = await db
      .select()
      .from(users)
      .where(conditions)
      .orderBy(sql`${orderColumn} ${orderDirection}`)
      .limit(options.limit)
      .offset(offset);

    return {
      users: userResults.map((user: any) => ({ ...user, hashedPassword: undefined })),
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit)
    };
  }

  async getSubscriptionTiers(): Promise<any[]> {
    // This would typically come from a tiers table, but for now return static data
    return [
      { id: 'free', name: 'Free', price: 0 },
      { id: 'basic', name: 'Basic', price: 9.99 },
      { id: 'premium', name: 'Premium', price: 19.99 },
      { id: 'enterprise', name: 'Enterprise', price: 49.99 }
    ];
  }

  async getUserGrowthData(startDate: Date): Promise<any[]> {
    const result = await db
      .select({
        date: sql`DATE(${users.createdAt})`,
        count: sql`count(*)`
      })
      .from(users)
      .where(sql`${users.createdAt} >= ${startDate.toISOString()}`)
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);
    
    return result;
  }

  async getSubscriptionAnalytics(startDate: Date): Promise<{
    byTier: any[];
    growth: any[];
    churn: any[];
  }> {
    // Subscriptions by tier
    const byTier = await db
      .select({
        tier: userSubscriptions.tierId,
        count: sql`count(*)`
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.status, 'active'))
      .groupBy(userSubscriptions.tierId);

    // Subscription growth
    const growth = await db
      .select({
        date: sql`DATE(${userSubscriptions.createdAt})`,
        count: sql`count(*)`
      })
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.status, 'active'),
        sql`${userSubscriptions.createdAt} >= ${startDate.toISOString()}`
      ))
      .groupBy(sql`DATE(${userSubscriptions.createdAt})`)
      .orderBy(sql`DATE(${userSubscriptions.createdAt})`);

    return {
      byTier,
      growth,
      churn: [] // Would need additional tracking for churn analysis
    };
  }

  async getUsageAnalytics(startDate: Date): Promise<{
    totalDocuments: number;
    totalTokens: number;
    avgDocumentsPerUser: number;
    byTier: any[];
  }> {
    const totalResult = await db
      .select({
        totalDocuments: sql`sum(${usageRecords.documentsAnalyzed})`,
        totalTokens: sql`sum(${usageRecords.tokensUsed})`
      })
      .from(usageRecords)
      .where(sql`${usageRecords.createdAt} >= ${startDate.toISOString()}`);

    const userCountResult = await db
      .select({ count: sql`count(DISTINCT ${usageRecords.userId})` })
      .from(usageRecords)
      .where(sql`${usageRecords.createdAt} >= ${startDate.toISOString()}`);

    const totalDocuments = parseInt(totalResult[0]?.totalDocuments as string) || 0;
    const totalTokens = parseInt(totalResult[0]?.totalTokens as string) || 0;
    const userCount = parseInt(userCountResult[0]?.count as string) || 1;

    const byTierResult = await db
      .select({
        tier: sql`COALESCE(${userSubscriptions.tierId}, 'free')`,
        documents: sql`sum(${usageRecords.documentsAnalyzed})`,
        tokens: sql`sum(${usageRecords.tokensUsed})`
      })
      .from(usageRecords)
      .leftJoin(userSubscriptions, eq(usageRecords.subscriptionId, userSubscriptions.id))
      .where(sql`${usageRecords.createdAt} >= ${startDate.toISOString()}`)
      .groupBy(sql`COALESCE(${userSubscriptions.tierId}, 'free')`);

    return {
      totalDocuments,
      totalTokens,
      avgDocumentsPerUser: Math.round(totalDocuments / userCount),
      byTier: byTierResult
    };
  }

  async getRevenueAnalytics(startDate: Date): Promise<{
    totalRevenue: number;
    byTier: any[];
    growth: any[];
  }> {
    // This would need payment records table for accurate revenue tracking
    // For now, estimate based on active subscriptions and tier prices
    const tierPrices: Record<string, number> = {
      'free': 0,
      'basic': 9.99,
      'premium': 19.99,
      'enterprise': 49.99
    };

    const byTier = await db
      .select({
        tier: userSubscriptions.tierId,
        count: sql`count(*)`
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.status, 'active'))
      .groupBy(userSubscriptions.tierId);

    const estimatedRevenue = byTier.reduce((total: number, tier: any) => {
      return total + (tierPrices[tier.tier] || 0) * parseInt(tier.count as string);
    }, 0);

    return {
      totalRevenue: estimatedRevenue,
      byTier: byTier.map((tier: any) => ({
        ...tier,
        revenue: (tierPrices[tier.tier] || 0) * parseInt(tier.count as string)
      })),
      growth: [] // Would need historical revenue data
    };
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const user = result[0];
    return { ...user, hashedPassword: undefined } as any;
  }

  // Admin-specific functions
  async deleteUser(userId: string, options: {
    includeSubscriptions?: boolean;
    includeDocuments?: boolean;
    includeSecurityEvents?: boolean;
    reason?: string;
  } = {}): Promise<{
    deletedUser: boolean;
    deletedSubscriptions: number;
    deletedDocuments: number;
    deletedSecurityEvents: number;
  }> {
    let deletedSubscriptions = 0;
    let deletedDocuments = 0;
    let deletedSecurityEvents = 0;

    // Delete user subscriptions if requested
    if (options.includeSubscriptions) {
      const subscriptionResults = await db
        .delete(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .returning();
      deletedSubscriptions = subscriptionResults.length;
    }

    // Delete usage records
    const usageResults = await db
      .delete(usageRecords)
      .where(eq(usageRecords.userId, userId))
      .returning();

    // Delete email change requests
    const emailResults = await db
      .delete(emailChangeRequests)
      .where(eq(emailChangeRequests.userId, userId))
      .returning();

    // Delete user
    const userResults = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();

    return {
      deletedUser: userResults.length > 0,
      deletedSubscriptions,
      deletedDocuments,
      deletedSecurityEvents
    };
  }

  async clearUserDocuments(userId: string): Promise<{ count: number }> {
    // For session-based documents, we'd need to track user->session mapping
    // For now, return mock result
    return { count: 0 };
  }

  async clearUserUsageHistory(userId: string): Promise<{ count: number }> {
    const results = await db
      .delete(usageRecords)
      .where(eq(usageRecords.userId, userId))
      .returning();
    
    return { count: results.length };
  }

  async clearUserSecurityEvents(userId: string): Promise<{ count: number }> {
    // Security events are handled by securityLogger, not database
    return { count: 0 };
  }

  async clearUserSessions(userId: string): Promise<{ count: number }> {
    // Sessions are in-memory, would need user->session mapping
    return { count: 0 };
  }

  async hashPassword(password: string): Promise<string> {
    const argon2 = await import('argon2');
    return argon2.hash(password);
  }

}