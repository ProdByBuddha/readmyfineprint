/**
 * Distributed Session Storage Implementation
 * Provides scalable session management with PostgreSQL and Redis support
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { sql, eq, and, lt } from "drizzle-orm";
import { pgTable, text, timestamp, json, integer, boolean } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { Pool } from "@neondatabase/serverless";

// Session table schema
export const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
  data: json('data').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  userId: text('user_id'),
  ipHash: text('ip_hash'),
  userAgentHash: text('user_agent_hash'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export interface SessionData {
  [key: string]: any;
}

export interface SessionInfo {
  id: string;
  data: SessionData;
  expiresAt: Date;
  userId?: string;
  ipHash?: string;
  userAgentHash?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionConfig {
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  maxSessionsPerUser: number; // Maximum concurrent sessions per user
  enableCleanup: boolean;
}

class DistributedSessionStorage {
  private db: any;
  private config: SessionConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(database: any, config: Partial<SessionConfig> = {}) {
    this.db = database;
    this.config = {
      defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
      cleanupInterval: 15 * 60 * 1000, // 15 minutes
      maxSessionsPerUser: 5,
      enableCleanup: true,
      ...config
    };

    if (this.config.enableCleanup) {
      this.startCleanupTimer();
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    data: SessionData,
    userId?: string,
    ipHash?: string,
    userAgentHash?: string,
    ttl?: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + (ttl || this.config.defaultTTL));

    // If user has too many sessions, deactivate oldest ones
    if (userId && this.config.maxSessionsPerUser > 0) {
      await this.limitUserSessions(userId);
    }

    await this.db.insert(sessionsTable).values({
      id: sessionId,
      data,
      expiresAt,
      userId,
      ipHash,
      userAgentHash,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: sessionsTable.id,
      set: {
        data,
        expiresAt,
        userId,
        ipHash,
        userAgentHash,
        isActive: true,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const result = await this.db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.id, sessionId),
          eq(sessionsTable.isActive, true)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const session = result[0];

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.destroySession(sessionId);
      return null;
    }

    return {
      id: session.id,
      data: session.data as SessionData,
      expiresAt: session.expiresAt,
      userId: session.userId || undefined,
      ipHash: session.ipHash || undefined,
      userAgentHash: session.userAgentHash || undefined,
      isActive: session.isActive,
      createdAt: session.createdAt!,
      updatedAt: session.updatedAt!
    };
  }

  /**
   * Update session data
   */
  async updateSession(
    sessionId: string,
    data: Partial<SessionData>,
    extendTTL?: number
  ): Promise<boolean> {
    const currentSession = await this.getSession(sessionId);
    if (!currentSession) {
      return false;
    }

    const newData = { ...currentSession.data, ...data };
    const newExpiresAt = extendTTL 
      ? new Date(Date.now() + extendTTL)
      : currentSession.expiresAt;

    const result = await this.db
      .update(sessionsTable)
      .set({
        data: newData,
        expiresAt: newExpiresAt,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(sessionsTable.id, sessionId),
          eq(sessionsTable.isActive, true)
        )
      );

    return result.rowCount > 0;
  }

  /**
   * Touch session to extend TTL
   */
  async touchSession(sessionId: string, ttl?: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + (ttl || this.config.defaultTTL));

    const result = await this.db
      .update(sessionsTable)
      .set({
        expiresAt,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(sessionsTable.id, sessionId),
          eq(sessionsTable.isActive, true)
        )
      );

    return result.rowCount > 0;
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    const result = await this.db
      .update(sessionsTable)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(sessionsTable.id, sessionId));

    return result.rowCount > 0;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const result = await this.db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.userId, userId),
          eq(sessionsTable.isActive, true)
        )
      )
      .orderBy(sessionsTable.updatedAt);

    return result
      .filter((session: any) => session.expiresAt > new Date())
      .map((session: any) => ({
        id: session.id,
        data: session.data as SessionData,
        expiresAt: session.expiresAt,
        userId: session.userId || undefined,
        ipHash: session.ipHash || undefined,
        userAgentHash: session.userAgentHash || undefined,
        isActive: session.isActive,
        createdAt: session.createdAt!,
        updatedAt: session.updatedAt!
      }));
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string): Promise<number> {
    const result = await this.db
      .update(sessionsTable)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(sessionsTable.userId, userId),
          eq(sessionsTable.isActive, true)
        )
      );

    return result.rowCount || 0;
  }

  /**
   * Limit user sessions to maxSessionsPerUser
   */
  private async limitUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    if (sessions.length >= this.config.maxSessionsPerUser) {
      // Sort by last updated (oldest first) and deactivate excess sessions
      const sessionsToDeactivate = sessions
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
        .slice(0, sessions.length - this.config.maxSessionsPerUser + 1);

      for (const session of sessionsToDeactivate) {
        await this.destroySession(session.id);
      }
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db
      .update(sessionsTable)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(sessionsTable.isActive, true),
          lt(sessionsTable.expiresAt, new Date())
        )
      );

    return result.rowCount || 0;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    averageSessionAge: number;
  }> {
    const [totalResult] = await this.db
      .select({ count: sql`count(*)` })
      .from(sessionsTable);

    const [activeResult] = await this.db
      .select({ count: sql`count(*)` })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.isActive, true),
          sql`${sessionsTable.expiresAt} > now()`
        )
      );

    const [expiredResult] = await this.db
      .select({ count: sql`count(*)` })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.isActive, true),
          sql`${sessionsTable.expiresAt} <= now()`
        )
      );

    const [avgAgeResult] = await this.db
      .select({ 
        avgAge: sql`avg(extract(epoch from (now() - ${sessionsTable.createdAt})))` 
      })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.isActive, true),
          sql`${sessionsTable.expiresAt} > now()`
        )
      );

    return {
      totalSessions: Number(totalResult.count) || 0,
      activeSessions: Number(activeResult.count) || 0,
      expiredSessions: Number(expiredResult.count) || 0,
      averageSessionAge: Number(avgAgeResult.avgAge) || 0
    };
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const cleaned = await this.cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`[SessionStorage] Cleaned up ${cleaned} expired sessions`);
        }
      } catch (error) {
        console.error('[SessionStorage] Cleanup error:', error);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Initialize session storage (create tables if needed)
   */
  static async initialize(database: any, config?: Partial<SessionConfig>): Promise<DistributedSessionStorage> {
    // Create sessions table if it doesn't exist
    try {
      await database.execute(sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          user_id TEXT,
          ip_hash TEXT,
          user_agent_hash TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT now(),
          updated_at TIMESTAMP DEFAULT now()
        )
      `);

      // Create indexes for performance
      await database.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id) WHERE is_active = true
      `);
      
      await database.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at) WHERE is_active = true
      `);

      await database.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active, expires_at)
      `);

      console.log('[SessionStorage] Session storage initialized successfully');
    } catch (error) {
      console.error('[SessionStorage] Failed to initialize session storage:', error);
      throw error;
    }

    return new DistributedSessionStorage(database, config);
  }
}

export { DistributedSessionStorage };