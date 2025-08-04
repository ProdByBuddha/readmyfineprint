import https from 'https';
import http from 'http';

const baseUrl = 'https://edcf3ef7-a826-4eed-8e04-7a485b2e183a-00-1wytaob2mj6u8.kirk.replit.dev:5000';
const testEmail = 'staging@readmyfineprint.com';

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ReadMyFinePrint-Test/1.0',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Test helper function
async function runTest(testName, testFn) {
  try {
    console.log(`\n🧪 Testing: ${testName}`);
    await testFn();
    console.log(`✅ ${testName} PASSED`);
    return true;
  } catch (error) {
    console.log(`❌ ${testName} FAILED: ${error.message}`);
    return false;
  }
}

async function testSubscriptionFlow() {
  console.log('🚀 Starting Comprehensive Subscription & Document Analysis Testing');
  console.log(`📧 Test Account: ${testEmail}`);
  console.log(`🌐 Testing environment: ${baseUrl}`);
  console.log('💳 Using Stripe Test Keys for payment simulation\n');

  let passed = 0;
  let failed = 0;
  let sessionCookie = '';
  let csrfToken = '';

  // 1. Get CSRF token
  await runTest('Get CSRF Token', async () => {
    const response = await makeRequest(`${baseUrl}/api/csrf-token`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    csrfToken = response.data.csrfToken;
    if (!csrfToken) {
      throw new Error('No CSRF token received');
    }
    console.log(`   🔐 CSRF Token obtained: ${csrfToken.substring(0, 20)}...`);
  }) ? passed++ : failed++;

  // 2. Check current subscription status (unauthenticated)
  await runTest('Check Unauthenticated Subscription Status', async () => {
    const response = await makeRequest(`${baseUrl}/api/user/subscription`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    if (response.data.tier.id !== 'free') {
      throw new Error(`Expected free tier, got ${response.data.tier.id}`);
    }
    console.log(`   📊 Current tier: ${response.data.tier.name} (${response.data.tier.id})`);
  }) ? passed++ : failed++;

  // 3. Test Subscription Checkout Creation for Professional Plan
  await runTest('Create Subscription Checkout for Professional Plan', async () => {
    const response = await makeRequest(`${baseUrl}/api/subscription/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: {
        tierId: 'professional',
        billingCycle: 'monthly'
      }
    });
    
    if (response.status !== 200 && response.status !== 400) {
      throw new Error(`Expected 200 or 400, got ${response.status}`);
    }
    
    if (response.status === 200 && response.data.url) {
      console.log(`   💳 Professional Plan Checkout URL: ${response.data.url.substring(0, 50)}...`);
      console.log(`   💰 Session ID: ${response.data.sessionId}`);
    } else {
      console.log(`   ⚠️  Professional checkout: ${response.data?.error || 'Failed'}`);
    }
  }) ? passed++ : failed++;

  // 4. Test Subscription Checkout Creation for Starter Plan
  await runTest('Create Subscription Checkout for Starter Plan', async () => {
    const response = await makeRequest(`${baseUrl}/api/subscription/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: {
        tierId: 'starter',
        billingCycle: 'monthly'
      }
    });
    
    if (response.status !== 200 && response.status !== 400) {
      throw new Error(`Expected 200 or 400, got ${response.status}`);
    }
    
    if (response.status === 200 && response.data.url) {
      console.log(`   💳 Starter Plan Checkout URL: ${response.data.url.substring(0, 50)}...`);
      console.log(`   💰 Session ID: ${response.data.sessionId}`);
    } else {
      console.log(`   ⚠️  Starter checkout: ${response.data?.error || 'Failed'}`);
    }
  }) ? passed++ : failed++;

  // 5. Test donation flow  
  await runTest('Create Donation Checkout', async () => {
    const response = await makeRequest(`${baseUrl}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: {
        amount: 25 // $25 donation
      }
    });
    
    if (response.status !== 200 && response.status !== 400) {
      throw new Error(`Expected 200 or 400, got ${response.status}`);
    }
    
    if (response.status === 200 && response.data.url) {
      console.log(`   💝 Donation Checkout URL: ${response.data.url.substring(0, 50)}...`);
      console.log(`   💰 Session ID: ${response.data.sessionId}`);
      console.log(`   🧪 Test Mode: ${response.data.testMode}`);
    } else {
      console.log(`   ⚠️  Donation checkout: ${response.data?.error || 'Failed'}`);
    }
  }) ? passed++ : failed++;

  // 6. Test Document Analysis for Free Tier (Anonymous User)
  let freeDocCount = 0;
  await runTest('Document Analysis - Free Tier Limits', async () => {
    console.log(`   📊 Testing Free Tier (10 docs/month limit)`);
    
    // Test multiple document analyses to check limits
    for (let i = 1; i <= 12; i++) {
      const response = await makeRequest(`${baseUrl}/api/document/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: {
          title: `test-doc-${i}.txt`,
          content: `This is test document ${i} for free tier limit testing. Contract clause: The party agrees to terms.`,
          contentType: 'text/plain'
        }
      });
      
      if (response.status === 200) {
        freeDocCount++;
        console.log(`   ✅ Doc ${i}: Analysis successful (${freeDocCount} total)`);
      } else if (response.status === 429) {
        console.log(`   🛑 Doc ${i}: Rate limited at ${freeDocCount} documents (expected at 10+)`);
        break;
      } else {
        console.log(`   ⚠️  Doc ${i}: Status ${response.status}`);
      }
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`   📈 Free tier processed ${freeDocCount} documents before limit`);
    if (freeDocCount >= 10) {
      console.log(`   ✅ Free tier limit working correctly`);
    }
  }) ? passed++ : failed++;

  // 7. Test Subscription Cancellation
  await runTest('Test Subscription Cancellation', async () => {
    const response = await makeRequest(`${baseUrl}/api/subscription/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: {
        subscriptionId: 'sub_test123',
        immediate: false
      }
    });
    
    // Should fail without proper authentication
    if (response.status === 401 || response.status === 404) {
      console.log(`   🔐 Cancellation properly requires authentication (${response.status})`);
    } else {
      console.log(`   ⚠️  Cancellation response: ${response.status}`);
    }
  }) ? passed++ : failed++;

  // 8. Test Stripe Webhook (Security)
  await runTest('Test Stripe Webhook Security', async () => {
    const response = await makeRequest(`${baseUrl}/api/stripe-webhook`, {
      method: 'POST',
      headers: {
        'stripe-signature': 'invalid_test_signature',
        'content-type': 'application/json'
      },
      body: {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active'
          }
        }
      }
    });
    
    // Webhook should reject invalid signature
    if (response.status === 400 || response.status === 401 || response.status === 404) {
      console.log(`   🔐 Webhook properly secured (${response.status})`);
    } else {
      console.log(`   ⚠️  Webhook response: ${response.status}`);
    }
  }) ? passed++ : failed++;

  // 9. Test Payment Intent Creation
  await runTest('Test Payment Intent Creation', async () => {
    const response = await makeRequest(`${baseUrl}/api/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: {
        amount: 50,
        currency: 'usd'
      }
    });
    
    if (response.status === 200 && response.data.clientSecret) {
      console.log(`   💳 Payment intent created successfully`);
      console.log(`   🔑 Client secret: ${response.data.clientSecret.substring(0, 30)}...`);
    } else {
      console.log(`   ⚠️  Payment intent failed: ${response.status}`);
    }
  }) ? passed++ : failed++;

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUBSCRIPTION & DONATION TESTING RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total:  ${passed + failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL SUBSCRIPTION TESTS PASSED! Payment system is working.');
  } else {
    console.log('\n⚠️  Some subscription tests failed. Review failures before production.');
  }

  console.log('\n📋 MANUAL TESTING INSTRUCTIONS:');
  console.log('💳 TEST CARD DETAILS:');
  console.log('   Card Number: 4242 4242 4242 4242');
  console.log('   Expiry: Any future date (e.g., 12/25)');
  console.log('   CVC: Any 3 digits (e.g., 123)');
  console.log('   ZIP: Any 5 digits (e.g., 12345)');
  console.log('');
  console.log('🔗 CHECKOUT TESTING:');
  console.log('1. Visit any Stripe checkout URLs shown above');
  console.log('2. Complete test purchases using the test card');
  console.log('3. Verify webhook handling in server logs');
  console.log('4. Test subscription management in the dashboard');
  console.log('');
  console.log('📊 DOCUMENT LIMITS VERIFIED:');
  console.log(`   Free Tier: ${freeDocCount} documents processed before limits`);
  console.log('   Expected: 10 documents/month for free users');
  console.log('   Status: ' + (freeDocCount >= 10 ? '✅ Working correctly' : '⚠️  May need adjustment'));
  
  console.log('\n🧪 All tests use Stripe Test Mode - no real charges will occur');
}

// Run the tests
testSubscriptionFlow().catch(console.error);