import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testConsentSystem() {
  console.log('🧪 Testing Cookie Consent System for All User Types\n');

  // Test 1: Anonymous User Consent
  console.log('📝 Test 1: Anonymous User Consent');
  try {
    const anonymousConsent = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: 'anonymous-user-ip',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        termsVersion: '1.0'
      })
    });
    const anonymousResult = await anonymousConsent.json();
    console.log('   ✅ Anonymous consent logging:', anonymousResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   📋 Response:', anonymousResult.message || anonymousResult.error);
  } catch (error) {
    console.log('   ❌ Anonymous consent test failed:', error.message);
  }

  // Test 2: Session-based Consent Verification
  console.log('\n📝 Test 2: Session-based Consent Verification');
  try {
    const sessionVerify = await fetch(`${BASE_URL}/api/consent/verify?sessionId=test-session-456`);
    const sessionResult = await sessionVerify.json();
    console.log('   ✅ Session verification:', sessionResult.verified ? 'VERIFIED' : 'NOT VERIFIED');
    console.log('   📋 Details:', sessionResult.message || 'No message');
  } catch (error) {
    console.log('   ❌ Session verification test failed:', error.message);
  }

  // Test 3: User-based Consent (Simulating Authenticated User)
  console.log('\n📝 Test 3: Authenticated User Consent');
  try {
    const userConsent = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: 'user-ip-address',
        userAgent: 'Mozilla/5.0 (User Browser)',
        termsVersion: '1.0',
        userId: 'test-user-123'
      })
    });
    const userResult = await userConsent.json();
    console.log('   ✅ User consent logging:', userResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   📋 Response:', userResult.message || userResult.error);
  } catch (error) {
    console.log('   ❌ User consent test failed:', error.message);
  }

  // Test 4: Consent Revocation
  console.log('\n📝 Test 4: Consent Revocation');
  try {
    const revokeConsent = await fetch(`${BASE_URL}/api/consent/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: 'revoke-test-ip',
        userAgent: 'Mozilla/5.0 (Revoke Browser)'
      })
    });
    const revokeResult = await revokeConsent.json();
    console.log('   ✅ Consent revocation:', revokeResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   📋 Response:', revokeResult.message || revokeResult.error);
  } catch (error) {
    console.log('   ❌ Consent revocation test failed:', error.message);
  }

  // Test 5: Admin User Consent (Should work same as regular users)
  console.log('\n📝 Test 5: Admin User Consent');
  try {
    const adminConsent = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: 'admin-ip-address',
        userAgent: 'Mozilla/5.0 (Admin Browser)',
        termsVersion: '1.0',
        userId: 'admin-user-123'
      })
    });
    const adminResult = await adminConsent.json();
    console.log('   ✅ Admin consent logging:', adminResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   📋 Response:', adminResult.message || adminResult.error);
  } catch (error) {
    console.log('   ❌ Admin consent test failed:', error.message);
  }

  console.log('\n🎯 Cookie Consent System Test Complete');
  console.log('📊 All user types should have functional consent tracking');
}

testConsentSystem();