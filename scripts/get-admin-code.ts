#!/usr/bin/env tsx
/**
 * Script to generate and display admin verification code for local testing
 */

import { adminVerificationService } from '../server/admin-verification';

async function getAdminCode() {
  try {
    console.log('🔧 Generating admin verification code for local testing...');
    
    // Generate a verification code
    const result = await adminVerificationService.sendAdminVerificationCode('127.0.0.1', 'local-test');
    
    if (!result.success) {
      console.error('❌ Failed to generate verification code:', result.message);
      return;
    }
    
    console.log('✅ Verification code generated successfully');
    
    // Since the verification codes are stored in memory, we need to access the private field
    // For testing purposes only, let's use reflection to get the codes
    const service = adminVerificationService as any;
    const codes = service.verificationCodes;
    
    if (codes && codes.size > 0) {
      const latestCode = Array.from(codes.values()).pop();
      if (latestCode && !latestCode.used) {
        console.log('\n🔑 ADMIN VERIFICATION CODE (for local testing):');
        console.log(`📋 Code: ${latestCode.code}`);
        console.log(`⏰ Expires: ${latestCode.expiresAt}`);
        console.log('\n💡 Use this code with:');
        console.log(`curl -X POST -H "Content-Type: application/json" -d '{"code":"${latestCode.code}"}' http://localhost:5000/api/admin/verify-code`);
      }
    } else {
      console.log('⚠️ No verification codes found in memory');
    }
    
  } catch (error) {
    console.error('❌ Error generating admin code:', error);
  }
}

// Run the script
getAdminCode().then(() => {
  console.log('\n✅ Admin verification code retrieval completed');
}).catch(error => {
  console.error('❌ Failed to get admin code:', error);
  process.exit(1);
});