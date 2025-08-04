import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testFrontendConsentFlow() {
  console.log('🌐 Testing Frontend Cookie Consent Flow\n');

  // Test 1: Check if homepage loads with consent system
  console.log('📝 Test 1: Homepage Load (New User Experience)');
  try {
    const homepageResponse = await fetch(`${BASE_URL}/`);
    const homepageHtml = await homepageResponse.text();
    
    // Check for consent-related elements in the HTML
    const hasCookieScript = homepageHtml.includes('CombinedConsent') || homepageHtml.includes('cookie');
    const hasConsentComponents = homepageHtml.includes('consent') || homepageHtml.includes('privacy');
    
    console.log('   ✅ Homepage loads:', homepageResponse.status === 200 ? 'SUCCESS' : 'FAILED');
    console.log('   🍪 Cookie consent elements:', hasCookieScript ? 'PRESENT' : 'NOT FOUND');
    console.log('   📋 Privacy/consent references:', hasConsentComponents ? 'PRESENT' : 'NOT FOUND');
  } catch (error) {
    console.log('   ❌ Homepage test failed:', error.message);
  }

  // Test 2: Check specific consent API endpoints
  console.log('\n📝 Test 2: Consent API Endpoint Availability');
  
  const endpoints = [
    '/api/consent',
    '/api/consent/revoke',
    '/api/consent/status'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: endpoint === '/api/consent/revoke' ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: endpoint !== '/api/consent/status' ? JSON.stringify({
          ip: 'test-ip',
          userAgent: 'Test-Agent'
        }) : undefined
      });
      
      console.log(`   ✅ ${endpoint}:`, response.status < 500 ? 'AVAILABLE' : 'ERROR');
    } catch (error) {
      console.log(`   ❌ ${endpoint}: FAILED`);
    }
  }

  // Test 3: Simulate Different User Type Scenarios
  console.log('\n📝 Test 3: User Type Scenarios');

  // Anonymous user
  try {
    const anonResponse = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: 'anon-user-ip',
        userAgent: 'Anonymous-Browser',
        termsVersion: '1.0'
      })
    });
    const anonResult = await anonResponse.json();
    console.log('   👤 Anonymous user consent:', anonResult.success ? 'WORKING' : 'ISSUE');
  } catch (error) {
    console.log('   👤 Anonymous user consent: ERROR');
  }

  // Authenticated user simulation
  try {
    const userResponse = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: 'auth-user-ip',
        userAgent: 'Authenticated-Browser',
        termsVersion: '1.0',
        userId: 'test-authenticated-user'
      })
    });
    const userResult = await userResponse.json();
    console.log('   🔐 Authenticated user consent:', userResult.success ? 'WORKING' : 'ISSUE');
  } catch (error) {
    console.log('   🔐 Authenticated user consent: ERROR');
  }

  console.log('\n🎯 Frontend Consent Flow Test Complete');
}

testFrontendConsentFlow();