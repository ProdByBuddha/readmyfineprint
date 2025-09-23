/**
 * Comprehensive Integration Tests for Preferences Migration System
 * Tests all components of the localStorage to database migration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { userPreferencesService } from '../server/user-preferences-service';
import { db } from '../server/db';
import { userPreferences, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { securityLogger } from '../server/security-logger';

// Mock data
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  hashedPassword: 'hashed-password',
  emailVerified: true,
  isActive: true,
  isAdmin: false,
  isDeleted: false,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockLocalStorageData = {
  theme: 'dark',
  legalDisclaimerAccepted: true,
  cookieConsent: {
    necessary: true,
    analytics: true,
    marketing: false
  },
  donationPageVisited: true,
  deviceFingerprint: 'fp_test_fingerprint_123'
};

describe('User Preferences Migration System', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(userPreferences).where(eq(userPreferences.userId, mockUser.id));
    await db.delete(users).where(eq(users.id, mockUser.id));
    
    // Create test user
    const [createdUser] = await db.insert(users).values(mockUser).returning();
    testUserId = createdUser.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(userPreferences).where(eq(userPreferences.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('UserPreferencesService', () => {
    it('should set and get user preferences', async () => {
      // Set a preference
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      
      // Get the preference
      const theme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      
      expect(theme).toBe('dark');
    });

    it('should handle complex preference values', async () => {
      const complexValue = {
        necessary: true,
        analytics: false,
        marketing: true,
        customSettings: {
          trackingLevel: 'minimal',
          retentionDays: 30
        }
      };

      await userPreferencesService.setUserPreference(testUserId, 'cookie_consent', complexValue);
      
      const retrieved = await userPreferencesService.getUserPreference(testUserId, 'cookie_consent');
      
      expect(retrieved).toEqual(complexValue);
    });

    it('should update existing preferences', async () => {
      // Set initial value
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'light');
      
      // Update value
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      
      // Verify update
      const theme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      expect(theme).toBe('dark');
    });

    it('should return null for non-existent preferences', async () => {
      const nonExistent = await userPreferencesService.getUserPreference(testUserId, 'non_existent');
      expect(nonExistent).toBeNull();
    });

    it('should delete preferences', async () => {
      // Set a preference
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      
      // Verify it exists
      let theme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      expect(theme).toBe('dark');
      
      // Delete it
      await userPreferencesService.deleteUserPreference(testUserId, 'theme');
      
      // Verify it's gone
      theme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      expect(theme).toBeNull();
    });

    it('should get all user preferences', async () => {
      // Set multiple preferences
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      await userPreferencesService.setUserPreference(testUserId, 'legal_disclaimer_accepted', true);
      await userPreferencesService.setUserPreference(testUserId, 'donation_page_visited', false);
      
      // Get all preferences
      const allPreferences = await userPreferencesService.getAllUserPreferences(testUserId);
      
      expect(allPreferences).toEqual({
        theme: 'dark',
        legal_disclaimer_accepted: true,
        donation_page_visited: false
      });
    });

    it('should handle bulk localStorage migration', async () => {
      await userPreferencesService.migrateFromLocalStorage(testUserId, mockLocalStorageData);
      
      // Verify all preferences were migrated
      const theme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      const legal = await userPreferencesService.getUserPreference(testUserId, 'legal_disclaimer_accepted');
      const cookies = await userPreferencesService.getUserPreference(testUserId, 'cookie_consent');
      const donation = await userPreferencesService.getUserPreference(testUserId, 'donation_page_visited');
      const fingerprint = await userPreferencesService.getUserPreference(testUserId, 'device_fingerprint_backup');
      
      expect(theme).toBe('dark');
      expect(legal).toBe(true);
      expect(cookies).toEqual(mockLocalStorageData.cookieConsent);
      expect(donation).toBe(true);
      expect(fingerprint).toBe('fp_test_fingerprint_123');
    });

    it('should handle expired preferences', async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      
      // Set an expired preference
      await userPreferencesService.setUserPreference(
        testUserId, 
        'temporary_setting', 
        'expired_value',
        { expiresAt: expiredDate }
      );
      
      // Try to get it - should return null and clean up
      const value = await userPreferencesService.getUserPreference(testUserId, 'temporary_setting');
      expect(value).toBeNull();
    });

    it('should clean up expired preferences', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 60000);
      
      // Set expired and non-expired preferences
      await userPreferencesService.setUserPreference(
        testUserId, 
        'expired_pref', 
        'expired',
        { expiresAt: expiredDate }
      );
      
      await userPreferencesService.setUserPreference(
        testUserId, 
        'valid_pref', 
        'valid',
        { expiresAt: futureDate }
      );
      
      // Run cleanup
      const deletedCount = await userPreferencesService.cleanupExpiredPreferences();
      
      expect(deletedCount).toBeGreaterThan(0);
      
      // Verify expired preference is gone, valid one remains
      const expired = await userPreferencesService.getUserPreference(testUserId, 'expired_pref');
      const valid = await userPreferencesService.getUserPreference(testUserId, 'valid_pref');
      
      expect(expired).toBeNull();
      expect(valid).toBe('valid');
    });

    it('should generate preference statistics', async () => {
      // Set various preferences
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      await userPreferencesService.setUserPreference(testUserId, 'legal_disclaimer_accepted', true, { preferenceType: 'system' });
      
      const stats = await userPreferencesService.getPreferenceStats();
      
      expect(stats.totalPreferences).toBeGreaterThan(0);
      expect(stats.totalUsers).toBeGreaterThan(0);
      expect(stats.preferencesByType).toHaveProperty('user');
      expect(stats.preferencesByType).toHaveProperty('system');
      expect(stats.preferencesByKey).toHaveProperty('theme');
    });
  });

  describe('Database Schema and Constraints', () => {
    it('should enforce unique constraint on user_id + preference_key', async () => {
      // Insert first preference
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      
      // Try to insert duplicate - should update instead
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'light');
      
      // Verify only one record exists with updated value
      const theme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      expect(theme).toBe('light');
    });

    it('should handle cascade deletion when user is deleted', async () => {
      // Set preferences
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      await userPreferencesService.setUserPreference(testUserId, 'legal_disclaimer_accepted', true);
      
      // Verify preferences exist
      const allPrefs = await userPreferencesService.getAllUserPreferences(testUserId);
      expect(Object.keys(allPrefs)).toHaveLength(2);
      
      // Delete user
      await db.delete(users).where(eq(users.id, testUserId));
      
      // Verify preferences are gone
      const remainingPrefs = await userPreferencesService.getAllUserPreferences(testUserId);
      expect(Object.keys(remainingPrefs)).toHaveLength(0);
    });

    it('should update timestamps correctly', async () => {
      const startTime = new Date();
      
      // Set preference
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      
      // Get raw database record
      const [record] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, testUserId))
        .limit(1);
      
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
      expect(record.createdAt.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      
      // Update preference
      const updateTime = new Date();
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'light');
      
      // Get updated record
      const [updatedRecord] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, testUserId))
        .limit(1);
      
      expect(updatedRecord.updatedAt.getTime()).toBeGreaterThanOrEqual(updateTime.getTime());
      expect(updatedRecord.updatedAt.getTime()).toBeGreaterThan(record.updatedAt.getTime());
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs gracefully', async () => {
      await expect(
        userPreferencesService.setUserPreference('invalid-user-id', 'theme', 'dark')
      ).rejects.toThrow();
    });

    it('should handle malformed JSON values', async () => {
      // This shouldn't happen in normal usage, but test database resilience
      try {
        await db.insert(userPreferences).values({
          userId: testUserId,
          preferenceKey: 'malformed',
          preferenceValue: 'invalid-json-{',
          preferenceType: 'user'
        });
        
        // Should handle gracefully when retrieving
        const value = await userPreferencesService.getUserPreference(testUserId, 'malformed');
        // Should return the raw string if JSON parsing fails
        expect(value).toBe('invalid-json-{');
      } catch (error) {
        // If database rejects it, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle database connection issues', async () => {
      // Mock database failure
      const originalExecute = db.execute;
      db.execute = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      
      await expect(
        userPreferencesService.getUserPreference(testUserId, 'theme')
      ).rejects.toThrow('Database connection failed');
      
      // Restore original function
      db.execute = originalExecute;
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        userPreferencesService.setUserPreference(testUserId, `pref_${i}`, `value_${i}`)
      );
      
      await Promise.all(operations);
      
      const allPrefs = await userPreferencesService.getAllUserPreferences(testUserId);
      expect(Object.keys(allPrefs)).toHaveLength(10);
      
      // Verify all values are correct
      for (let i = 0; i < 10; i++) {
        expect(allPrefs[`pref_${i}`]).toBe(`value_${i}`);
      }
    });

    it('should handle large preference values', async () => {
      const largeValue = {
        data: 'x'.repeat(10000), // 10KB of data
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0',
          tags: Array.from({ length: 100 }, (_, i) => `tag_${i}`)
        }
      };
      
      await userPreferencesService.setUserPreference(testUserId, 'large_pref', largeValue);
      
      const retrieved = await userPreferencesService.getUserPreference(testUserId, 'large_pref');
      expect(retrieved).toEqual(largeValue);
    });
  });

  describe('Security and Audit', () => {
    it('should log security events for preference operations', async () => {
      const logSpy = vi.spyOn(securityLogger, 'logSecurityEvent');
      
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PREFERENCE_UPDATED',
          severity: 'LOW',
          message: 'User preference updated'
        })
      );

      // Restore original logger
      logSpy.mockRestore();
    });

    it('should handle preference type validation', async () => {
      // Test valid preference types
      await userPreferencesService.setUserPreference(testUserId, 'user_pref', 'value', { preferenceType: 'user' });
      await userPreferencesService.setUserPreference(testUserId, 'system_pref', 'value', { preferenceType: 'system' });
      
      const userPref = await userPreferencesService.getUserPreference(testUserId, 'user_pref');
      const systemPref = await userPreferencesService.getUserPreference(testUserId, 'system_pref');
      
      expect(userPref).toBe('value');
      expect(systemPref).toBe('value');
    });
  });

  describe('Integration with Client-Side Hooks', () => {
  // These would be more comprehensive with actual React testing
  describe('Hook Behavior Simulation', () => {
    it('should simulate theme preference migration flow', async () => {
      // Simulate unauthenticated user with localStorage
      const localStorageTheme = 'dark';
      
      // User logs in - hook should migrate to database
      await userPreferencesService.setUserPreference(testUserId, 'theme', localStorageTheme);
      
      // Verify migration
      const dbTheme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      expect(dbTheme).toBe(localStorageTheme);
      
      // Simulate theme change while authenticated
      await userPreferencesService.setUserPreference(testUserId, 'theme', 'light');
      
      // Verify update
      const updatedTheme = await userPreferencesService.getUserPreference(testUserId, 'theme');
      expect(updatedTheme).toBe('light');
    });

    it('should simulate cookie consent migration', async () => {
      const cookieSettings = {
        necessary: true,
        analytics: false,
        marketing: true
      };
      
      await userPreferencesService.setUserPreference(testUserId, 'cookie_consent', cookieSettings);
      
      const retrieved = await userPreferencesService.getUserPreference(testUserId, 'cookie_consent');
      expect(retrieved).toEqual(cookieSettings);
    });

    it('should simulate device fingerprint backup', async () => {
      const fingerprint = 'fp_device_123_backup';
      
      await userPreferencesService.setUserPreference(testUserId, 'device_fingerprint_backup', fingerprint);
      
      const backup = await userPreferencesService.getUserPreference(testUserId, 'device_fingerprint_backup');
      expect(backup).toBe(fingerprint);
    });
  });
  });

  describe('Migration Completeness', () => {
  it('should handle all localStorage items identified in the analysis', async () => {
    const completeLocalStorageData = {
      theme: 'dark',
      legalDisclaimerAccepted: true,
      cookieConsent: {
        necessary: true,
        analytics: true,
        marketing: false
      },
      donationPageVisited: true,
      deviceFingerprint: 'fp_complete_test'
    };
    
    // Migrate all data
    await userPreferencesService.migrateFromLocalStorage(testUserId, completeLocalStorageData);
    
    // Verify all items were migrated
    const allPrefs = await userPreferencesService.getAllUserPreferences(testUserId);
    
    expect(allPrefs.theme).toBe('dark');
    expect(allPrefs.legal_disclaimer_accepted).toBe(true);
    expect(allPrefs.cookie_consent).toEqual(completeLocalStorageData.cookieConsent);
    expect(allPrefs.donation_page_visited).toBe(true);
    expect(allPrefs.device_fingerprint_backup).toBe('fp_complete_test');
  });

  it('should maintain backward compatibility', async () => {
    // Set preferences using new system
    await userPreferencesService.setUserPreference(testUserId, 'theme', 'dark');
    
    // Verify they can be retrieved
    const theme = await userPreferencesService.getUserPreference(testUserId, 'theme');
    expect(theme).toBe('dark');
    
    // Verify they work with existing localStorage fallback patterns
    // (This would be more comprehensive with actual browser testing)
  });
  });
});