// Simple test to verify CSRF token functionality
const fetch = require('node-fetch');

async function testCSRFToken() {
  try {
    console.log('Testing CSRF token endpoint...');
    
    // Test GET /api/csrf-token (should work without CSRF token)
    const response = await fetch('http://localhost:3000/api/csrf-token', {
      method: 'GET',
      headers: {
        'x-session-id': 'test-session-' + Date.now(),
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ CSRF token endpoint working:', !!data.csrfToken);
      console.log('Token preview:', data.csrfToken?.substring(0, 16) + '...');
      return data.csrfToken;
    } else {
      console.log('❌ CSRF token endpoint failed:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.log('❌ Error testing CSRF token:', error.message);
    return null;
  }
}

async function testConsentVerifyWithCSRF() {
  try {
    console.log('Testing consent verification with CSRF...');
    
    const sessionId = 'test-session-' + Date.now();
    
    // First get CSRF token
    const tokenResponse = await fetch('http://localhost:3000/api/csrf-token', {
      method: 'GET',
      headers: {
        'x-session-id': sessionId,
      },
    });
    
    if (!tokenResponse.ok) {
      console.log('❌ Failed to get CSRF token');
      return;
    }
    
    const { csrfToken } = await tokenResponse.json();
    
    // Now test consent verification with CSRF token
    const verifyResponse = await fetch('http://localhost:3000/api/consent/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
        'x-csrf-token': csrfToken,
      },
    });
    
    console.log('Consent verification status:', verifyResponse.status);
    
    if (verifyResponse.status === 403) {
      const errorData = await verifyResponse.json();
      if (errorData.code === 'CSRF_TOKEN_MISSING') {
        console.log('❌ CSRF token still missing!');
      } else if (errorData.code === 'CSRF_TOKEN_INVALID') {
        console.log('❌ CSRF token invalid!');
      } else {
        console.log('✅ CSRF protection working - other 403 reason:', errorData.error);
      }
    } else {
      console.log('✅ CSRF protection working - request processed');
      const data = await verifyResponse.json();
      console.log('Response:', data);
    }
    
  } catch (error) {
    console.log('❌ Error testing consent verification:', error.message);
  }
}

// Only run if server is running
if (process.argv.includes('--run-test')) {
  testCSRFToken().then(token => {
    if (token) {
      testConsentVerifyWithCSRF();
    }
  });
} else {
  console.log('Test script ready. Start the server and run: node test-csrf-fix.js --run-test');
}