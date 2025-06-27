import fetch from 'node-fetch';

interface CSRFTokenResponse {
  csrfToken: string;
}

interface ConsentVerifyResponse {
  hasConsented?: boolean;
  proof?: any;
  error?: string;
  code?: string;
}

async function testCSRFFlow() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const sessionId = 'test-session-' + Date.now();
  
  console.log('🧪 Testing CSRF functionality...');
  console.log(`Using base URL: ${baseUrl}`);
  console.log(`Session ID: ${sessionId}`);
  
  try {
    // Step 1: Get CSRF token
    console.log('\n1️⃣ Getting CSRF token...');
    const tokenResponse = await fetch(`${baseUrl}/api/csrf-token`, {
      method: 'GET',
      headers: {
        'x-session-id': sessionId,
      },
    });
    
    if (!tokenResponse.ok) {
      console.log(`❌ Failed to get CSRF token: ${tokenResponse.status} ${tokenResponse.statusText}`);
      return;
    }
    
    const tokenData = await tokenResponse.json() as CSRFTokenResponse;
    console.log(`✅ CSRF token received: ${tokenData.csrfToken.substring(0, 16)}...`);
    
    // Step 2: Test POST request without CSRF token (should fail)
    console.log('\n2️⃣ Testing POST without CSRF token (should fail)...');
    const noTokenResponse = await fetch(`${baseUrl}/api/consent/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
    });
    
    if (noTokenResponse.status === 403) {
      const errorData = await noTokenResponse.json() as ConsentVerifyResponse;
      if (errorData.code === 'CSRF_TOKEN_MISSING') {
        console.log('✅ CSRF protection working - request blocked without token');
      } else {
        console.log(`⚠️ Request blocked but different error: ${errorData.error}`);
      }
    } else {
      console.log(`❌ Request should have been blocked but got status: ${noTokenResponse.status}`);
    }
    
    // Step 3: Test POST request with CSRF token (should work)
    console.log('\n3️⃣ Testing POST with CSRF token (should work)...');
    const withTokenResponse = await fetch(`${baseUrl}/api/consent/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
        'x-csrf-token': tokenData.csrfToken,
      },
    });
    
    console.log(`Status: ${withTokenResponse.status}`);
    
    if (withTokenResponse.status === 403) {
      const errorData = await withTokenResponse.json() as ConsentVerifyResponse;
      if (errorData.code === 'CSRF_TOKEN_MISSING' || errorData.code === 'CSRF_TOKEN_INVALID') {
        console.log(`❌ CSRF token issue: ${errorData.error}`);
      } else {
        console.log(`✅ CSRF protection working - different authorization issue: ${errorData.error}`);
      }
    } else if (withTokenResponse.ok) {
      console.log('✅ CSRF protection working - request processed successfully');
      const data = await withTokenResponse.json();
      console.log('Response data:', data);
    } else {
      console.log(`⚠️ Unexpected status: ${withTokenResponse.status}`);
      const text = await withTokenResponse.text();
      console.log('Response:', text);
    }
    
    console.log('\n🎉 CSRF functionality test completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
if (require.main === module) {
  testCSRFFlow();
}

export { testCSRFFlow };