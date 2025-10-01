import 'dotenv/config';  // Load .env file
import { emailService } from './email-service';

/**
 * Test script to send sample subscription emails
 * Usage: tsx server/test-emails.ts
 */

const TEST_EMAIL = 'prodbybuddha@icloud.com';

async function testEmails() {
  console.log('🧪 Testing subscription email templates...\n');
  
  // Show SMTP configuration status
  console.log('📧 SMTP Configuration:');
  console.log(`   Host: ${process.env.SMTP_HOST || 'NOT SET'}`);
  console.log(`   Port: ${process.env.SMTP_PORT || 'NOT SET'}`);
  console.log(`   User: ${process.env.SMTP_USER || 'NOT SET'}`);
  console.log(`   Pass: ${process.env.SMTP_PASS ? '****' + process.env.SMTP_PASS.slice(-4) : 'NOT SET'}`);
  console.log(`   From: ${process.env.FROM_EMAIL || 'NOT SET'}\n`);

  try {
    // Test 1: Subscription Created
    console.log('1️⃣  Testing Subscription Created email...');
    await emailService.sendSubscriptionCreated({
      userEmail: TEST_EMAIL,
      userName: 'Buddha',
      tier: 'Professional',
      priceAmount: 4900, // $49.00 in cents
      billingInterval: 'month',
      subscriptionId: 'sub_test_123456789',
      customerId: 'cus_test_123456789',
    });
    console.log('✅ Subscription Created email sent\n');

    // Wait a bit between emails
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Subscription Updated (Active)
    console.log('2️⃣  Testing Subscription Updated email (Active)...');
    await emailService.sendSubscriptionUpdated({
      userEmail: TEST_EMAIL,
      userName: 'Buddha',
      tier: 'Professional',
      priceAmount: 4900,
      billingInterval: 'month',
      subscriptionId: 'sub_test_123456789',
      customerId: 'cus_test_123456789',
      status: 'active',
    });
    console.log('✅ Subscription Updated email sent\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Subscription Canceled
    console.log('3️⃣  Testing Subscription Canceled email...');
    await emailService.sendSubscriptionCanceled({
      userEmail: TEST_EMAIL,
      userName: 'Buddha',
      tier: 'Professional',
      priceAmount: 4900,
      billingInterval: 'month',
      subscriptionId: 'sub_test_123456789',
      customerId: 'cus_test_123456789',
    });
    console.log('✅ Subscription Canceled email sent\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Payment Failed
    console.log('4️⃣  Testing Payment Failed email...');
    await emailService.sendPaymentFailed({
      userEmail: TEST_EMAIL,
      userName: 'Buddha',
      tier: 'Professional',
      priceAmount: 4900,
      billingInterval: 'month',
      subscriptionId: 'sub_test_123456789',
      customerId: 'cus_test_123456789',
    });
    console.log('✅ Payment Failed email sent\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Trial Ending
    console.log('5️⃣  Testing Trial Ending email...');
    await emailService.sendTrialEnding({
      userEmail: TEST_EMAIL,
      userName: 'Buddha',
      tier: 'Professional',
      priceAmount: 4900,
      billingInterval: 'month',
      subscriptionId: 'sub_test_123456789',
      customerId: 'cus_test_123456789',
      daysLeft: 3,
    });
    console.log('✅ Trial Ending email sent\n');

    console.log('🎉 All test emails completed!');
    console.log(`📧 Check inbox at: ${TEST_EMAIL}\n`);
    console.log('Note: If SMTP is not configured, emails were logged to console only (mock mode)');
    
  } catch (error) {
    console.error('❌ Error sending test emails:', error);
    process.exit(1);
  }
}

// Run tests
testEmails()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
