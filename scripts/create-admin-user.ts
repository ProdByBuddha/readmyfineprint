/**
 * Script to create admin user: admin@readmyfineprint.com
 * This creates the admin account with proper permissions
 */

import { databaseStorage } from '../server/storage';
import { hashPassword } from '../server/argon2';
import crypto from 'crypto';

async function createAdminUser() {
  console.log('🔧 Creating admin user: admin@readmyfineprint.com');

  try {
    // Check if admin user already exists
    const existingUser = await databaseStorage.getUserByEmail('admin@readmyfineprint.com');
    
    if (existingUser) {
      console.log('✅ Admin user already exists');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Created: ${existingUser.createdAt}`);
      return;
    }

    // Generate a secure random password
    const adminPassword = crypto.randomBytes(16).toString('hex');
    console.log(`🔑 Generated admin password: ${adminPassword}`);
    console.log('⚠️  IMPORTANT: Save this password securely!');

    // Hash the password
    const hashedPassword = await hashPassword(adminPassword);

    // Create the admin user
    const adminUser = await databaseStorage.createUser({
      email: 'admin@readmyfineprint.com',
      username: 'admin',
      hashedPassword: hashedPassword,
      emailVerified: true,
      isActive: true,
      isAdmin: true
    });

    console.log('✅ Admin user created successfully');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('');
    console.log('🔐 Admin Login Credentials:');
    console.log(`   Email: admin@readmyfineprint.com`);
    console.log(`   Password: ${adminPassword}`);
    console.log('');
    console.log('⚠️  SECURITY NOTE: Change this password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('✅ Admin user creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });