/**
 * PostgreSQL Token Storage
 * Secure storage for subscription tokens using PostgreSQL database
 */

import { db, ensureDbInitialized } from './db';
import { subscriptionTokens, type SubscriptionToken, type InsertSubscriptionToken } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import crypto from 'crypto';

interface TokenData {
  userId: string;
  subscriptionId?: string | null;
  tierId: string;
  deviceFingerprint?: string;
  expiresAt?: string;
  usageCount?: number;
  lastUsed?: string;
}

export class PostgreSQLTokenStorage {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || '';
  }

  /**
   * Store a subscription token securely
   */
  async storeToken(token: string, data: Omit<TokenData, 'expiresAt' | 'usageCount' | 'lastUsed'>): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const tokenData: InsertSubscriptionToken = {
        token,
        userId: data.userId,
        subscriptionId: data.subscriptionId || null,
        tierId: data.tierId,
        deviceFingerprint: data.deviceFingerprint || null,
        usageCount: 0,
        lastUsed: now,
        expiresAt,
      };

      await db.insert(subscriptionTokens).values(tokenData);

      console.log(`Stored subscription token in PostgreSQL: ${token.slice(0, 16)}...`);
    } catch (error) {
      console.error('Error storing token in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Retrieve and validate a subscription token
   */
  async getToken(token: string): Promise<TokenData | null> {
    try {
      const [tokenRecord] = await db
        .select()
        .from(subscriptionTokens)
        .where(eq(subscriptionTokens.token, token));

      if (!tokenRecord) {
        return null;
      }

      // Check if token is expired
      if (new Date(tokenRecord.expiresAt) < new Date()) {
        // Token expired - remove it
        await this.removeToken(token);
        return null;
      }

      return {
        userId: tokenRecord.userId,
        subscriptionId: tokenRecord.subscriptionId,
        tierId: tokenRecord.tierId,
        deviceFingerprint: tokenRecord.deviceFingerprint || undefined,
        expiresAt: tokenRecord.expiresAt.toISOString(),
        usageCount: tokenRecord.usageCount,
        lastUsed: tokenRecord.lastUsed.toISOString(),
      };
    } catch (error) {
      console.error('Error retrieving token from PostgreSQL:', error);
      return null;
    }
  }

  /**
   * Update token usage statistics
   */
  async updateTokenUsage(token: string): Promise<void> {
    try {
      const now = new Date();
      
      await db
        .update(subscriptionTokens)
        .set({
          usageCount: sql`${subscriptionTokens.usageCount} + 1`,
          lastUsed: now,
          updatedAt: now,
        })
        .where(eq(subscriptionTokens.token, token));
    } catch (error) {
      console.error('Error updating token usage:', error);
    }
  }

  /**
   * Remove a subscription token
   */
  async removeToken(token: string): Promise<boolean> {
    try {
      const result = await db
        .delete(subscriptionTokens)
        .where(eq(subscriptionTokens.token, token));

      return result.rowCount ? result.rowCount > 0 : true;
    } catch (error) {
      console.error('Error removing token from PostgreSQL:', error);
      return false;
    }
  }

  /**
   * Remove all tokens for a specific user
   */
  async removeAllUserTokens(userId: string): Promise<number> {
    try {
      const result = await db
        .delete(subscriptionTokens)
        .where(eq(subscriptionTokens.userId, userId));

      const removedCount = result.rowCount || 0;
      console.log(`Removed ${removedCount} tokens for user ${userId}`);
      return removedCount;
    } catch (error) {
      console.error('Error removing user tokens:', error);
      return 0;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpired(): Promise<{ tokensRemoved: number }> {
    try {
      await ensureDbInitialized();
      
      // Check if database has delete method
      if (!db || typeof db.delete !== 'function') {
        console.log('⚠️ Database delete method not available, skipping token cleanup');
        return { tokensRemoved: 0 };
      }
      
      const now = new Date();
      
      const result = await db
        .delete(subscriptionTokens)
        .where(lt(subscriptionTokens.expiresAt, now));

      const tokensRemoved = result.rowCount || 0;
      console.log(`Cleanup completed: ${tokensRemoved} expired tokens removed`);
      return { tokensRemoved };
    } catch (error) {
      console.error('Error during token cleanup:', error);
      return { tokensRemoved: 0 };
    }
  }

  /**
   * Get all tokens for a user
   */
  async getUserTokens(userId: string): Promise<SubscriptionToken[]> {
    try {
      const tokens = await db
        .select()
        .from(subscriptionTokens)
        .where(eq(subscriptionTokens.userId, userId));

      return tokens;
    } catch (error) {
      console.error('Error getting user tokens:', error);
      return [];
    }
  }

  /**
   * Check if a token exists and is valid
   */
  async isValidToken(token: string): Promise<boolean> {
    try {
      const tokenData = await this.getToken(token);
      return tokenData !== null;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }
}

// Export singleton instance
export const postgresqlTokenStorage = new PostgreSQLTokenStorage();