/**
 * PostgreSQL Session Storage
 * Secure storage for session-to-token mappings using PostgreSQL database
 */

import { db, ensureDbInitialized } from './db';
import { sessionTokens, type SessionToken, type InsertSessionToken } from '@shared/schema';
import { eq, lt } from 'drizzle-orm';

export class PostgreSQLSessionStorage {
  /**
   * Store a session-to-token mapping
   */
  async storeSessionToken(sessionId: string, token: string, userId?: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours for session mapping

      // Validate UUID format if userId is provided
      let validUserId: string | null = null;
      if (userId) {
        // Check if it's a valid UUID format (8-4-4-4-12 characters)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(userId)) {
          validUserId = userId;
        } else {
          console.warn(`Invalid UUID format for userId: ${userId}, storing session without user reference`);
        }
      }

      const sessionData: InsertSessionToken = {
        sessionId,
        token,
        userId: validUserId,
        expiresAt,
      };

      // Remove any existing session mapping first
      await this.removeSessionToken(sessionId);

      await db.insert(sessionTokens).values(sessionData);

      console.log(`Stored session token mapping in PostgreSQL: ${sessionId} -> ${token.slice(0, 8)}... ${validUserId ? `(user: ${validUserId})` : '(no user)'}`);
    } catch (error) {
      console.error('Error storing session token mapping in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Retrieve a token by session ID
   */
  async getTokenBySession(sessionId: string): Promise<string | null> {
    try {
      const [sessionRecord] = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.sessionId, sessionId));

      if (!sessionRecord) {
        return null;
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        // Session expired - remove it
        await this.removeSessionToken(sessionId);
        return null;
      }

      return sessionRecord.token;
    } catch (error) {
      console.error('Error retrieving session token from PostgreSQL:', error);
      return null;
    }
  }

  /**
   * Remove a session token mapping
   */
  async removeSessionToken(sessionId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(sessionTokens)
        .where(eq(sessionTokens.sessionId, sessionId));

      return result.rowCount ? result.rowCount > 0 : true;
    } catch (error) {
      console.error('Error removing session token from PostgreSQL:', error);
      return false;
    }
  }

  /**
   * Clean up expired session tokens
   */
  async cleanupExpired(): Promise<{ sessionsRemoved: number }> {
    try {
      await ensureDbInitialized();
      
      // Check if database has delete method
      if (!db || typeof db.delete !== 'function') {
        console.log('⚠️ Database delete method not available, skipping session cleanup');
        return { sessionsRemoved: 0 };
      }
      
      const now = new Date();
      
      const result = await db
        .delete(sessionTokens)
        .where(lt(sessionTokens.expiresAt, now));

      const sessionsRemoved = result.rowCount || 0;
      console.log(`Session cleanup completed: ${sessionsRemoved} expired sessions removed`);
      return { sessionsRemoved };
    } catch (error) {
      console.error('Error during session cleanup:', error);
      return { sessionsRemoved: 0 };
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionToken[]> {
    try {
      const sessions = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.userId, userId));

      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Remove all sessions for a user
   */
  async removeAllUserSessions(userId: string): Promise<number> {
    try {
      const result = await db
        .delete(sessionTokens)
        .where(eq(sessionTokens.userId, userId));

      const removedCount = result.rowCount || 0;
      console.log(`Removed ${removedCount} sessions for user ${userId}`);
      return removedCount;
    } catch (error) {
      console.error('Error removing user sessions:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const postgresqlSessionStorage = new PostgreSQLSessionStorage(); 