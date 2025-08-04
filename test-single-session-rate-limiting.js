#!/usr/bin/env node

/**
 * Test document analysis rate limiting enforcement with consistent session
 * This simulates a real user session with consistent session and device fingerprint
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

console.log(`🧪 Testing Single Session Rate Limiting on ${BASE_URL}`);
console.log('========================================================');

// Create a consistent session by using cookies
const cookieJar = [];

// Simulate device fingerprint
const deviceFingerprint = 'test-device-12345678';

async function makeRequest(method, url, data = {}, headers = {}) {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: {
      'Content-Type': 'application/json',
      'x-device-fingerprint': deviceFingerprint,
      ...headers
    }
  };

  if (data && Object.keys(data).length > 0) {
    config.data = data;
  }

  // Add cookies to maintain session
  if (cookieJar.length > 0) {
    config.headers['Cookie'] = cookieJar.join('; ');
  }

  try {
    const response = await axios(config);
    
    // Store cookies for session persistence
    if (response.headers['set-cookie']) {
      response.headers['set-cookie'].forEach(cookie => {
        const cookieName = cookie.split('=')[0];
        // Remove existing cookie with same name
        const existingIndex = cookieJar.findIndex(c => c.startsWith(cookieName + '='));
        if (existingIndex >= 0) {
          cookieJar.splice(existingIndex, 1);
        }
        // Add new cookie
        cookieJar.push(cookie.split(';')[0]);
      });
    }
    
    return response;
  } catch (error) {
    // Return error response for rate limit testing
    if (error.response) {
      return error.response;
    }
    throw error;
  }
}

async function testSingleSessionRateLimit() {
  console.log('\n📋 Testing single session rate limiting (maintains session state)');
  
  // First create a document to establish session
  console.log('🔗 Creating initial document to establish session...');
  const createResponse = await makeRequest('POST', '/api/documents', {
    title: 'Session Rate Limit Test Document',
    content: 'This is a test contract for single session rate limiting verification.',
    fileType: 'text'
  });
  
  if (createResponse.status !== 200) {
    console.log(`❌ Failed to create test document: ${createResponse.data?.error || 'Unknown error'}`);
    return;
  }
  
  const documentId = createResponse.data.id;
  console.log(`✅ Created test document with ID: ${documentId}`);
  console.log(`🍪 Session cookies: ${cookieJar.length > 0 ? cookieJar.map(c => c.split('=')[0]).join(', ') : 'none'}`);
  
  // Test rate limiting with consistent session
  let successCount = 0;
  let limitReached = false;
  let lastUsageInfo = null;
  
  for (let i = 1; i <= 15; i++) {
    console.log(`\n🔄 Test ${i}: Analyzing document ${documentId}...`);
    
    const response = await makeRequest('POST', `/api/documents/${documentId}/analyze`, {
      testMode: true // Skip OpenAI calls for testing
    }, {
      'X-Skip-OpenAI': 'true'
    });
    
    if (response.status === 200) {
      successCount++;
      
      // Check usage info if available
      if (response.data.usage) {
        lastUsageInfo = response.data.usage;
        console.log(`✅ Analysis ${i}: Success (${lastUsageInfo.documentsUsed}/${lastUsageInfo.documentsLimit} used)`);
      } else {
        console.log(`✅ Analysis ${i}: Success (no usage info returned)`);
      }
    } else if (response.status === 429) {
      limitReached = true;
      const data = response.data;
      console.log(`🛑 Analysis ${i}: Rate limit reached!`);
      console.log(`   Error: ${data.error}`);
      console.log(`   Limit: ${data.limit}`);
      console.log(`   Used: ${data.used}`);
      if (data.resetDate) {
        console.log(`   Reset Date: ${data.resetDate}`);
      }
      if (data.upgradeRequired) {
        console.log(`   Upgrade Required: ${data.upgradeRequired}`);
      }
      break;
    } else {
      console.log(`❌ Analysis ${i}: Error (${response.status}) - ${response.data?.error || 'Unknown error'}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n📊 Single Session Results:`);
  console.log(`   🍪 Session maintained: ${cookieJar.length > 0 ? 'Yes' : 'No'}`);
  console.log(`   📱 Device fingerprint: ${deviceFingerprint}`);
  console.log(`   ✅ Successful analyses: ${successCount}`);
  console.log(`   🛑 Rate limit reached: ${limitReached ? 'Yes' : 'No'}`);
  
  if (lastUsageInfo) {
    console.log(`   📈 Final usage: ${lastUsageInfo.documentsUsed}/${lastUsageInfo.documentsLimit}`);
  }
  
  if (limitReached && successCount === 10) {
    console.log(`   ✅ RATE LIMITING WORKING CORRECTLY (10 free documents allowed)`);
    return true;
  } else if (!limitReached && successCount >= 10) {
    console.log(`   ❌ RATE LIMITING NOT WORKING (should limit to 10 documents)`);
    return false;
  } else {
    console.log(`   ⚠️  Unexpected result: ${successCount} successes, limit reached: ${limitReached}`);
    return false;
  }
}

async function runTests() {
  try {
    console.log('🔄 Starting single session rate limiting test...\n');
    
    const rateLimitWorking = await testSingleSessionRateLimit();
    
    console.log('\n🎯 Test Summary:');
    console.log('================');
    if (rateLimitWorking) {
      console.log('✅ Rate limiting is working correctly!');
      console.log('🔒 Free tier properly limited to 10 documents per month');
    } else {
      console.log('❌ Rate limiting is NOT working properly');
      console.log('🚨 This is a critical issue that must be fixed before production');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();