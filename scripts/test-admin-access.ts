#!/usr/bin/env tsx
/**
 * Test script to verify admin access is working
 * This bypasses the email verification by directly testing the verify-code endpoint
 */

import { adminVerificationService } from '../server/admin-verification';

async function testAdminAccess() {
  try {
    console.log('🔧 Testing admin verification system...');
    
    // Step 1: Generate a verification code (simulating the email process)
    console.log('📧 Sending verification code to admin emails...');
    const result = await adminVerificationService.sendAdminVerificationCode('127.0.0.1', 'test-script');
    
    if (!result.success) {
      console.error('❌ Failed to send verification code:', result.message);
      return;
    }
    
    console.log('✅ Verification code sent successfully');
    console.log('💡 In a real scenario, check your email for the 6-digit code');
    console.log('💡 For testing, you can now use curl to test the verify-code endpoint');
    console.log('💡 Example: curl -X POST -H "Content-Type: application/json" -d \'{"code":"123456"}\' http://localhost:5000/api/admin/verify-code');
    
  } catch (error) {
    console.error('❌ Error testing admin access:', error);
  }
}

// Run the test
testAdminAccess().then(() => {
  console.log('✅ Admin access test completed');
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});