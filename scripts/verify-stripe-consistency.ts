#!/usr/bin/env tsx

/**
 * Verify and fix Stripe customer ID consistency between users and subscriptions
 * Can be run periodically to ensure data integrity
 */

import { databaseStorage } from '../server/storage';

async function verifyStripeConsistency() {
  console.log('🔍 Verifying Stripe customer ID consistency...\n');
  
  try {
    const report = await databaseStorage.verifyStripeCustomerIdConsistency();
    
    console.log('📊 Consistency Report:');
    console.log(`   ✅ Consistent: ${report.consistent} subscriptions`);
    console.log(`   🔧 Fixed: ${report.fixed} subscriptions`);
    console.log(`   ❌ Errors: ${report.errors.length} issues`);
    
    if (report.errors.length > 0) {
      console.log('\n❌ Errors found:');
      report.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (report.fixed > 0) {
      console.log('\n🎉 Fixed data inconsistencies successfully!');
    } else if (report.errors.length === 0) {
      console.log('\n✨ All Stripe customer IDs are consistent!');
    }
    
    // Return non-zero exit code if there were errors
    if (report.errors.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run the verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyStripeConsistency().then(() => process.exit(0)).catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

export { verifyStripeConsistency };