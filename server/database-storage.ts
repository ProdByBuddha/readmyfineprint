import { db } from "./db";
import { users, userSubscriptions, usageRecords } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { type Document, type InsertDocument, type User, type InsertUser, type UserSubscription, type InsertUserSubscription, type UsageRecord, type InsertUsageRecord } from "@shared/schema";
import { type IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Document management (keeping session-based for now)
  private sessions: Map<string, { documents: Map<number, Document>; currentDocumentId: number; lastAccessed: Date }> = new Map();
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private clientSessions: Map<string, Set<string>> = new Map();

  constructor() {
    // Clean up expired sessions every 10 minutes
    setInterval(() => this.clearExpiredSessions(), 10 * 60 * 1000);
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
    if (!session) return undefined;
    session.lastAccessed = new Date();
    return session.documents.get(id);
  }

  async getAllDocuments(sessionId: string): Promise<Document[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
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
    });
  }

  // User management methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
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

  // Subscription management methods
  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .orderBy(desc(userSubscriptions.createdAt));
    return subscription || undefined;
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
    return subscription;
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
}