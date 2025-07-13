/**
 * User Preferences Service
 * Manages user preferences storage and retrieval with database persistence
 */

import { db } from './db';
import { eq, and, sql } from 'drizzle-orm';
import { userPreferences } from '@shared/schema';
import { securityLogger, SecurityEventType, SecuritySeverity, getClientInfo } from './security-logger';

export interface UserPreference {
  id: string;
  userId: string;
  preferenceKey: string;
  preferenceValue: any;
  preferenceType: 'user' | 'system';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferenceUpdateOptions {
  expiresAt?: Date;
  preferenceType?: 'user' | 'system';
}

export class UserPreferencesService {
  /**
   * Get a user preference by key
   */
  async getUserPreference(userId: string, preferenceKey: string): Promise<any | null> {
    try {
      if (!userId || !preferenceKey) {
        throw new Error('User ID and preference key are required');
      }

      const result = await db
        .select()
        .from(userPreferences)
        .where(
          and(
            eq(userPreferences.userId, userId),
            eq(userPreferences.preferenceKey, preferenceKey)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const preference = result[0];

      // Check if preference has expired
      if (preference.expiresAt && new Date() > preference.expiresAt) {
        await this.deleteUserPreference(userId, preferenceKey);
        return null;
      }

      try {
        return JSON.parse(preference.preferenceValue);
      } catch (error) {
        // If parsing fails, return the raw value
        return preference.preferenceValue;
      }
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_ACCESS_ERROR,
        SecuritySeverity.MEDIUM,
        'Failed to get user preference',
        { userId, preferenceKey, error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Set a user preference
   */
  async setUserPreference(
    userId: string,
    preferenceKey: string,
    preferenceValue: any,
    options: PreferenceUpdateOptions = {}
  ): Promise<void> {
    try {
      if (!userId || !preferenceKey) {
        throw new Error('User ID and preference key are required');
      }

      const preferenceData = {
        userId,
        preferenceKey,
        preferenceValue: JSON.stringify(preferenceValue),
        preferenceType: options.preferenceType || 'user',
        expiresAt: options.expiresAt || null
      };

      await db
        .insert(userPreferences)
        .values(preferenceData)
        .onConflictDoUpdate({
          target: [userPreferences.userId, userPreferences.preferenceKey],
          set: {
            preferenceValue: preferenceData.preferenceValue,
            preferenceType: preferenceData.preferenceType,
            expiresAt: preferenceData.expiresAt,
            updatedAt: sql`NOW()`
          }
        });

      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_UPDATED,
        SecuritySeverity.LOW,
        'User preference updated',
        { userId, preferenceKey, preferenceType: preferenceData.preferenceType }
      );
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_UPDATE_ERROR,
        SecuritySeverity.MEDIUM,
        'Failed to set user preference',
        { userId, preferenceKey, error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Get all user preferences
   */
  async getAllUserPreferences(userId: string): Promise<Record<string, any>> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const result = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));

      const preferences: Record<string, any> = {};
      const expiredKeys: string[] = [];

      for (const preference of result) {
        // Check if preference has expired
        if (preference.expiresAt && new Date() > preference.expiresAt) {
          expiredKeys.push(preference.preferenceKey);
          continue;
        }

        try {
          preferences[preference.preferenceKey] = JSON.parse(preference.preferenceValue);
        } catch (error) {
          // If parsing fails, return the raw value
          preferences[preference.preferenceKey] = preference.preferenceValue;
        }
      }

      // Clean up expired preferences
      if (expiredKeys.length > 0) {
        await this.deleteMultipleUserPreferences(userId, expiredKeys);
      }

      return preferences;
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_ACCESS_ERROR,
        SecuritySeverity.MEDIUM,
        'Failed to get all user preferences',
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Delete a user preference
   */
  async deleteUserPreference(userId: string, preferenceKey: string): Promise<void> {
    try {
      if (!userId || !preferenceKey) {
        throw new Error('User ID and preference key are required');
      }

      await db
        .delete(userPreferences)
        .where(
          and(
            eq(userPreferences.userId, userId),
            eq(userPreferences.preferenceKey, preferenceKey)
          )
        );

      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_DELETED,
        SecuritySeverity.LOW,
        'User preference deleted',
        { userId, preferenceKey }
      );
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_DELETE_ERROR,
        SecuritySeverity.MEDIUM,
        'Failed to delete user preference',
        { userId, preferenceKey, error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Delete multiple user preferences
   */
  async deleteMultipleUserPreferences(userId: string, preferenceKeys: string[]): Promise<void> {
    try {
      if (!userId || !preferenceKeys.length) {
        throw new Error('User ID and preference keys are required');
      }

      await db
        .delete(userPreferences)
        .where(
          and(
            eq(userPreferences.userId, userId),
            sql`${userPreferences.preferenceKey} = ANY(${preferenceKeys})`
          )
        );

      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_DELETED,
        SecuritySeverity.LOW,
        'Multiple user preferences deleted',
        { userId, preferenceKeys }
      );
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_DELETE_ERROR,
        SecuritySeverity.MEDIUM,
        'Failed to delete multiple user preferences',
        { userId, preferenceKeys, error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Delete all user preferences
   */
  async deleteAllUserPreferences(userId: string): Promise<void> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      await db
        .delete(userPreferences)
        .where(eq(userPreferences.userId, userId));

      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_DELETED,
        SecuritySeverity.MEDIUM,
        'All user preferences deleted',
        { userId }
      );
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_DELETE_ERROR,
        SecuritySeverity.HIGH,
        'Failed to delete all user preferences',
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Clean up expired preferences for all users
   */
  async cleanupExpiredPreferences(): Promise<number> {
    try {
      const result = await db
        .delete(userPreferences)
        .where(
          and(
            sql`${userPreferences.expiresAt} IS NOT NULL`,
            sql`${userPreferences.expiresAt} < NOW()`
          )
        );

      const deletedCount = result.rowCount || 0;

      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_CLEANUP,
        SecuritySeverity.LOW,
        'Expired preferences cleaned up',
        { deletedCount }
      );

      return deletedCount;
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_CLEANUP_ERROR,
        SecuritySeverity.MEDIUM,
        'Failed to cleanup expired preferences',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Migrate localStorage data to database
   */
  async migrateFromLocalStorage(userId: string, localStorageData: Record<string, any>): Promise<void> {
    try {
      if (!userId || !localStorageData) {
        throw new Error('User ID and localStorage data are required');
      }

      const migrations = [];

      // Theme preferences
      if (localStorageData.theme) {
        migrations.push(
          this.setUserPreference(userId, 'theme', localStorageData.theme)
        );
      }

      // Legal disclaimer acceptance
      if (localStorageData.legalDisclaimerAccepted !== undefined) {
        migrations.push(
          this.setUserPreference(userId, 'legal_disclaimer_accepted', localStorageData.legalDisclaimerAccepted)
        );
      }

      // Cookie consent
      if (localStorageData.cookieConsent) {
        migrations.push(
          this.setUserPreference(userId, 'cookie_consent', localStorageData.cookieConsent)
        );
      }

      // Donation page visited
      if (localStorageData.donationPageVisited !== undefined) {
        migrations.push(
          this.setUserPreference(userId, 'donation_page_visited', localStorageData.donationPageVisited)
        );
      }

      // Device fingerprint backup
      if (localStorageData.deviceFingerprint) {
        migrations.push(
          this.setUserPreference(userId, 'device_fingerprint_backup', localStorageData.deviceFingerprint)
        );
      }

      await Promise.all(migrations);

      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_MIGRATION,
        SecuritySeverity.LOW,
        'localStorage data migrated to database',
        { userId, migratedKeys: Object.keys(localStorageData) }
      );
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_MIGRATION_ERROR,
        SecuritySeverity.MEDIUM,
        'Failed to migrate localStorage data',
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Get preference statistics
   */
  async getPreferenceStats(): Promise<{
    totalPreferences: number;
    totalUsers: number;
    preferencesByType: Record<string, number>;
    preferencesByKey: Record<string, number>;
  }> {
    try {
      const [totalResult, typeResult, keyResult] = await Promise.all([
        db.execute(sql`
          SELECT 
            COUNT(*) as total_preferences,
            COUNT(DISTINCT user_id) as total_users
          FROM user_preferences
        `),
        db.execute(sql`
          SELECT 
            preference_type,
            COUNT(*) as count
          FROM user_preferences
          GROUP BY preference_type
        `),
        db.execute(sql`
          SELECT 
            preference_key,
            COUNT(*) as count
          FROM user_preferences
          GROUP BY preference_key
          ORDER BY count DESC
        `)
      ]);

      const preferencesByType: Record<string, number> = {};
      const preferencesByKey: Record<string, number> = {};

      for (const row of typeResult) {
        preferencesByType[row.preference_type as string] = Number(row.count);
      }

      for (const row of keyResult) {
        preferencesByKey[row.preference_key as string] = Number(row.count);
      }

      return {
        totalPreferences: Number(totalResult[0].total_preferences),
        totalUsers: Number(totalResult[0].total_users),
        preferencesByType,
        preferencesByKey
      };
    } catch (error) {
      securityLogger.logSecurityEvent(
        SecurityEventType.PREFERENCE_STATS_ERROR,
        SecuritySeverity.LOW,
        'Failed to get preference statistics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }
}

// Export singleton instance
export const userPreferencesService = new UserPreferencesService(); 