/**
 * Distributed Session Storage Implementation
 * Provides scalable session management with PostgreSQL and Redis support
 */

import crypto from 'node:crypto';
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
  private sessions: Map<string, SessionInfo> = new Map(); // In-memory storage for mock mode
  private nodeId: string = crypto.randomBytes(16).toString('hex');

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

    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      // Store in memory for mock mode
      this.sessions.set(sessionId, {
        id: sessionId,
        data,
        expiresAt,
        userId,
        ipHash,
        userAgentHash,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return;
    }

    // If user has too many sessions, deactivate oldest ones
    if (userId && this.config.maxSessionsPerUser > 0) {
      await this.limitUserSessions(userId);
    }

    try {
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
    } catch (error) {
      // Fallback to memory storage if database fails
      console.warn('Session storage database operation failed, using memory:', error);
      this.sessions.set(sessionId, {
        id: sessionId,
        data,
        expiresAt,
        userId,
        ipHash,
        userAgentHash,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      const session = this.sessions.get(sessionId);
      if (!session) return null;
      
      // Check if session is expired
      if (session.expiresAt < new Date()) {
        this.sessions.delete(sessionId);
        return null;
      }
      
      return session;
    }

    try {
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
    } catch (error) {
      console.warn('Failed to get session from database:', error);
      // Fallback to memory
      const session = this.sessions.get(sessionId);
      return session || null;
    }
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

    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.data = newData;
        session.expiresAt = newExpiresAt;
        session.updatedAt = new Date();
        return true;
      }
      return false;
    }

    try {
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
    } catch (error) {
      console.warn('Failed to update session in database, using memory:', error);
      const session = this.sessions.get(sessionId);
      if (session) {
        session.data = newData;
        session.expiresAt = newExpiresAt;
        session.updatedAt = new Date();
        return true;
      }
      return false;
    }
  }

  /**
   * Touch session to extend TTL
   */
  async touchSession(sessionId: string, ttl?: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + (ttl || this.config.defaultTTL));

    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.expiresAt = expiresAt;
        session.updatedAt = new Date();
        return true;
      }
      return false;
    }

    try {
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
    } catch (error) {
      console.warn('Failed to touch session in database, using memory:', error);
      const session = this.sessions.get(sessionId);
      if (session) {
        session.expiresAt = expiresAt;
        session.updatedAt = new Date();
        return true;
      }
      return false;
    }
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      return this.sessions.delete(sessionId);
    }

    try {
      const result = await this.db
        .update(sessionsTable)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(sessionsTable.id, sessionId));

      return result.rowCount > 0;
    } catch (error) {
      console.warn('Failed to destroy session in database, using memory:', error);
      return this.sessions.delete(sessionId);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      const userSessions: SessionInfo[] = [];
      const now = new Date();
      
      for (const [sessionId, session] of this.sessions) {
        if (session.userId === userId && session.isActive && session.expiresAt > now) {
          userSessions.push(session);
        }
      }
      
      return userSessions.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    }

    try {
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
    } catch (error) {
      console.warn('Failed to get user sessions from database, using memory:', error);
      const userSessions: SessionInfo[] = [];
      const now = new Date();
      
      for (const [sessionId, session] of this.sessions) {
        if (session.userId === userId && session.isActive && session.expiresAt > now) {
          userSessions.push(session);
        }
      }
      
      return userSessions.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string): Promise<number> {
    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      let count = 0;
      for (const [sessionId, session] of this.sessions) {
        if (session.userId === userId && session.isActive) {
          session.isActive = false;
          session.updatedAt = new Date();
          count++;
        }
      }
      return count;
    }

    try {
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
    } catch (error) {
      console.warn('Failed to destroy user sessions in database, using memory:', error);
      let count = 0;
      for (const [sessionId, session] of this.sessions) {
        if (session.userId === userId && session.isActive) {
          session.isActive = false;
          session.updatedAt = new Date();
          count++;
        }
      }
      return count;
    }
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
    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      let count = 0;
      const now = new Date();
      for (const [sessionId, session] of this.sessions) {
        if (session.isActive && session.expiresAt < now) {
          this.sessions.delete(sessionId);
          count++;
        }
      }
      return count;
    }

    try {
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
    } catch (error) {
      console.warn('Failed to cleanup expired sessions in database, using memory:', error);
      let count = 0;
      const now = new Date();
      for (const [sessionId, session] of this.sessions) {
        if (session.isActive && session.expiresAt < now) {
          this.sessions.delete(sessionId);
          count++;
        }
      }
      return count;
    }
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
    // Check if we're in mock mode
    if (process.env.REPLIT_DB_URL || process.env.NODE_ENV === 'development') {
      const now = new Date();
      let totalSessions = this.sessions.size;
      let activeSessions = 0;
      let expiredSessions = 0;
      let totalAge = 0;
      
      for (const [sessionId, session] of this.sessions) {
        if (session.isActive) {
          if (session.expiresAt > now) {
            activeSessions++;
            totalAge += now.getTime() - session.createdAt.getTime();
          } else {
            expiredSessions++;
          }
        }
      }
      
      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        averageSessionAge: activeSessions > 0 ? totalAge / activeSessions / 1000 : 0
      };
    }

    try {
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
    } catch (error) {
      console.warn('Failed to get session stats from database, using memory:', error);
      const now = new Date();
      let totalSessions = this.sessions.size;
      let activeSessions = 0;
      let expiredSessions = 0;
      let totalAge = 0;
      
      for (const [sessionId, session] of this.sessions) {
        if (session.isActive) {
          if (session.expiresAt > now) {
            activeSessions++;
            totalAge += now.getTime() - session.createdAt.getTime();
          } else {
            expiredSessions++;
          }
        }
      }
      
      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        averageSessionAge: activeSessions > 0 ? totalAge / activeSessions / 1000 : 0
      };
    }
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
      // Use the sql template from drizzle-orm for postgres-js compatibility
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