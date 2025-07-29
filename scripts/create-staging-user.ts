#!/usr/bin/env tsx

/**
 * Create Staging Test User
 * 
 * Creates a test user account for staging environment testing:
 * - Email: staging@readmyfineprint.com
 * - Password: StagingTest123!
 * - Email verified: true
 * - Active user for immediate testing
 */

import { databaseStorage } from '../server/storage';
import { hashPassword } from '../server/argon2';
import { insertUserSchema } from '@shared/schema';

async function createStagingUser() {
  console.log('🚧 Creating staging test user...');
  
  const testUserData = {
    email: 'staging@readmyfineprint.com',
    password: 'StagingTest123!',
    emailVerified: true,
    isActive: true,
    isAdmin: false,
    isDeleted: false,
    twoFactorEnabled: false
  };

  try {
    // Check if user already exists
    console.log(`🔍 Checking if user ${testUserData.email} already exists...`);
    const existingUser = await databaseStorage.getUserByEmail(testUserData.email);
    
    if (existingUser) {
      console.log(`✅ User ${testUserData.email} already exists!`);
      console.log(`   User ID: ${existingUser.id}`);
      console.log(`   Email Verified: ${existingUser.emailVerified}`);
      console.log(`   Active: ${existingUser.isActive}`);
      console.log(`   Created: ${existingUser.createdAt}`);
      return existingUser;
    }

    // Hash password with Argon2id
    console.log('🔐 Hashing password...');
    const hashedPassword = await hashPassword(testUserData.password);

    // Create user data for database insertion
    const userData = {
      email: testUserData.email,
      hashedPassword,
      emailVerified: testUserData.emailVerified,
      isActive: testUserData.isActive,
      isAdmin: testUserData.isAdmin,
      isDeleted: testUserData.isDeleted,
      twoFactorEnabled: testUserData.twoFactorEnabled
    };

    // Validate data against schema
    console.log('✅ Validating user data...');
    const validatedData = insertUserSchema.parse(userData);

    // Create user in database
    console.log('💾 Creating user in database...');
    const user = await databaseStorage.createUser(validatedData);

    // Create a default free tier subscription for the user
    console.log('🎯 Creating default free tier subscription...');
    try {
      const { subscriptionService } = await import('../server/subscription-service');
      await subscriptionService.ensureUserHasSubscription(user.id);
      console.log('✅ Default subscription created');
    } catch (error) {
      console.warn('⚠️  Failed to create default subscription:', error);
      console.log('   User created successfully but may need subscription setup');
    }

    console.log('\n🎉 Staging test user created successfully!');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${testUserData.password}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);
    
    console.log('\n📋 Test Instructions:');
    console.log('1. Navigate to your staging environment');
    console.log('2. Login with the credentials above');
    console.log('3. Test subscription functionality');
    console.log('4. Verify payment processing in test mode');
    
    return user;

  } catch (error) {
    console.error('❌ Failed to create staging user:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    
    throw error;
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createStagingUser()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { createStagingUser };