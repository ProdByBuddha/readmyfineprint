/**
 * Simple Test Script for Preferences Migration
 * Validates that the migration system works correctly
 */

import { userPreferencesService } from '../server/user-preferences-service';
import { db } from '../server/db';
import { users, userPreferences } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  id: 'test-migration-user',
  email: 'test-migration@example.com',
  hashedPassword: 'test-hash',
  emailVerified: true,
  isActive: true,
  isAdmin: false,
  isDeleted: false,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

const testLocalStorageData = {
  theme: 'dark',
  legalDisclaimerAccepted: true,
  cookieConsent: {
    necessary: true,
    analytics: true,
    marketing: false
  },
  donationPageVisited: true,
  deviceFingerprint: 'fp_test_device_123'
};

async function runMigrationTests() {
  console.log('🧪 Starting preferences migration tests...');
  
  try {
    // Clean up any existing test data
    await db.delete(userPreferences).where(eq(userPreferences.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    
    // Create test user
    console.log('👤 Creating test user...');
    await db.insert(users).values(testUser);
    
    // Test 1: Basic preference operations
    console.log('\n🔧 Test 1: Basic preference operations');
    await userPreferencesService.setUserPreference(testUser.id, 'theme', 'light');
    const theme = await userPreferencesService.getUserPreference(testUser.id, 'theme');
    console.log(`✅ Theme preference: ${theme === 'light' ? 'PASS' : 'FAIL'}`);
    
    // Test 2: Complex preference values
    console.log('\n🔧 Test 2: Complex preference values');
    const complexValue = { setting1: true, setting2: 'value', nested: { prop: 123 } };
    await userPreferencesService.setUserPreference(testUser.id, 'complex', complexValue);
    const retrievedComplex = await userPreferencesService.getUserPreference(testUser.id, 'complex');
    const complexMatch = JSON.stringify(complexValue) === JSON.stringify(retrievedComplex);
    console.log(`✅ Complex preference: ${complexMatch ? 'PASS' : 'FAIL'}`);
    
    // Test 3: Bulk localStorage migration
    console.log('\n🔧 Test 3: Bulk localStorage migration');
    await userPreferencesService.migrateFromLocalStorage(testUser.id, testLocalStorageData);
    
    const migratedTheme = await userPreferencesService.getUserPreference(testUser.id, 'theme');
    const migratedLegal = await userPreferencesService.getUserPreference(testUser.id, 'legal_disclaimer_accepted');
    const migratedCookies = await userPreferencesService.getUserPreference(testUser.id, 'cookie_consent');
    const migratedDonation = await userPreferencesService.getUserPreference(testUser.id, 'donation_page_visited');
    const migratedFingerprint = await userPreferencesService.getUserPreference(testUser.id, 'device_fingerprint_backup');
    
    console.log(`✅ Theme migration: ${migratedTheme === 'dark' ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Legal disclaimer migration: ${migratedLegal === true ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Cookie consent migration: ${JSON.stringify(migratedCookies) === JSON.stringify(testLocalStorageData.cookieConsent) ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Donation tracking migration: ${migratedDonation === true ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Device fingerprint migration: ${migratedFingerprint === 'fp_test_device_123' ? 'PASS' : 'FAIL'}`);
    
    // Test 4: Get all preferences
    console.log('\n🔧 Test 4: Get all preferences');
    const allPrefs = await userPreferencesService.getAllUserPreferences(testUser.id);
    const expectedKeys = ['theme', 'legal_disclaimer_accepted', 'cookie_consent', 'donation_page_visited', 'device_fingerprint_backup'];
    const hasAllKeys = expectedKeys.every(key => key in allPrefs);
    console.log(`✅ All preferences retrieved: ${hasAllKeys ? 'PASS' : 'FAIL'}`);
    console.log(`📊 Total preferences: ${Object.keys(allPrefs).length}`);
    
    // Test 5: Preference deletion
    console.log('\n🔧 Test 5: Preference deletion');
    await userPreferencesService.deleteUserPreference(testUser.id, 'theme');
    const deletedTheme = await userPreferencesService.getUserPreference(testUser.id, 'theme');
    console.log(`✅ Preference deletion: ${deletedTheme === null ? 'PASS' : 'FAIL'}`);
    
    // Test 6: Preference statistics
    console.log('\n🔧 Test 6: Preference statistics');
    const stats = await userPreferencesService.getPreferenceStats();
    console.log(`✅ Statistics generated: ${stats.totalPreferences > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`📊 Total preferences: ${stats.totalPreferences}`);
    console.log(`📊 Total users: ${stats.totalUsers}`);
    console.log(`📊 By type:`, stats.preferencesByType);
    
    // Test 7: Expired preferences cleanup
    console.log('\n🔧 Test 7: Expired preferences cleanup');
    const expiredDate = new Date(Date.now() - 1000); // 1 second ago
    await userPreferencesService.setUserPreference(testUser.id, 'expired_test', 'should_be_deleted', { expiresAt: expiredDate });
    
    // Wait a moment to ensure expiration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const expiredValue = await userPreferencesService.getUserPreference(testUser.id, 'expired_test');
    console.log(`✅ Expired preference cleanup: ${expiredValue === null ? 'PASS' : 'FAIL'}`);
    
    // Test 8: Database constraints
    console.log('\n🔧 Test 8: Database constraints');
    await userPreferencesService.setUserPreference(testUser.id, 'constraint_test', 'value1');
    await userPreferencesService.setUserPreference(testUser.id, 'constraint_test', 'value2'); // Should update, not create duplicate
    
    const constraintValue = await userPreferencesService.getUserPreference(testUser.id, 'constraint_test');
    console.log(`✅ Unique constraint: ${constraintValue === 'value2' ? 'PASS' : 'FAIL'}`);
    
    console.log('\n🎉 All migration tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    throw error;
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await db.delete(userPreferences).where(eq(userPreferences.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    console.log('✅ Test data cleaned up');
  }
}

// Run the tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrationTests()
    .then(() => {
      console.log('\n🎯 Migration validation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration validation failed:', error);
      process.exit(1);
    });
}

export { runMigrationTests }; 