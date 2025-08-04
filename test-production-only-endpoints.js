#!/usr/bin/env node

/**
 * Production-Only Endpoint Testing Suite
 * Tests only endpoints that would be available in a real production environment
 * Excludes development-only features like auto-login
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

// Test configuration for production endpoints only
const TEST_CONFIG = {
  ENVIRONMENTS: [
    'https://edcf3ef7-a826-4eed-8e04-7a485b2e183a-00-1wytaob2mj6u8.kirk.replit.dev:5000'
  ],
  TIMEOUT: 10000
};

// Test results tracking
let results = {
  passed: 0,
  failed: 0,
  failures: []
};

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      timeout: TEST_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Production-Test-Suite/1.0',
        ...options.headers
      }
    };

    // Add cookies if provided
    if (options.cookies) {
      requestOptions.headers.Cookie = options.cookies;
    }

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData,
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            raw: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runTest(name, testFn) {
  process.stdout.write(`🧪 Testing: ${name} `);
  try {
    await testFn();
    console.log('✅ PASSED');
    results.passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    results.failed++;
    results.failures.push(`${name}: ${error.message}`);
  }
}

// Production endpoint tests (no auth required)
async function testPublicEndpoints(baseUrl) {
  console.log('\n📋 Running Public Endpoint Tests...\n');

  await runTest('Public Homepage', async () => {
    const response = await makeRequest(`${baseUrl}/`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  await runTest('Health Check', async () => {
    const response = await makeRequest(`${baseUrl}/health`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    if (!response.data.status || response.data.status !== 'healthy') {
      throw new Error('Health check failed - service not healthy');
    }
  });

  await runTest('CSRF Token', async () => {
    const response = await makeRequest(`${baseUrl}/api/csrf-token`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    // Handle different CSRF token response formats
    if (!response.data.csrfToken && !response.data.token && !response.data.csrf) {
      throw new Error('CSRF token not returned in any expected format');
    }
  });
}

// Authentication-free tests
async function testUnauthenticatedEndpoints(baseUrl) {
  console.log('\n📋 Running Unauthenticated User Tests...\n');

  await runTest('Subscription Check (Unauthenticated)', async () => {
    const response = await makeRequest(`${baseUrl}/api/user/subscription`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    if (response.data.tier?.id !== 'free') {
      throw new Error(`Expected free tier, got ${response.data.tier?.id}`);
    }
  });

  await runTest('Document Analysis (Unauthenticated)', async () => {
    const response = await makeRequest(`${baseUrl}/api/document/analyze`, {
      method: 'POST',
      body: {
        content: 'This is a test document for analysis.',
        filename: 'test.txt'
      }
    });
    
    // Should succeed with analysis or return rate limit
    if (response.status !== 200 && response.status !== 429) {
      throw new Error(`Expected 200 or 429, got ${response.status}`);
    }
  });
}

// Security tests (should fail without auth)
async function testUnauthorizedAccess(baseUrl) {
  console.log('\n📋 Running Unauthorized Access Tests...\n');

  await runTest('Admin Endpoints Without Auth', async () => {
    const response = await makeRequest(`${baseUrl}/api/admin/metrics`);
    if (response.status !== 401 && response.status !== 403) {
      throw new Error(`Expected 401 or 403, got ${response.status}`);
    }
  });

  await runTest('Blog Admin Without Auth', async () => {
    const response = await makeRequest(`${baseUrl}/api/blog/admin/posts`);
    if (response.status !== 401 && response.status !== 403) {
      throw new Error(`Expected 401 or 403, got ${response.status}`);
    }
  });
}

// Stripe integration (should work without specific auth)
async function testStripeIntegration(baseUrl) {
  console.log('\n📋 Running Payment Integration Tests...\n');

  await runTest('Stripe Create Checkout Session', async () => {
    const response = await makeRequest(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: 'POST',
      body: {
        tier: 'starter',
        billingCycle: 'monthly'
      }
    });
    
    // Should create session or return validation error
    if (response.status !== 200 && response.status !== 400) {
      throw new Error(`Expected 200 or 400, got ${response.status}`);
    }
  });
}

// Blog public endpoints
async function testBlogEndpoints(baseUrl) {
  console.log('\n📋 Running Blog Public Tests...\n');

  await runTest('Blog Public Posts', async () => {
    const response = await makeRequest(`${baseUrl}/api/blog/posts`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  await runTest('Blog Public Categories', async () => {
    const response = await makeRequest(`${baseUrl}/api/blog/categories`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });
}

// Main test runner
async function runProductionTests() {
  console.log('🚀 Starting Production-Only Endpoint Testing Suite');
  console.log('📍 Testing real production endpoints (excluding dev features)');
  
  for (const baseUrl of TEST_CONFIG.ENVIRONMENTS) {
    console.log(`\n🌐 Testing environment: ${baseUrl}`);
    
    try {
      // Test if environment is accessible
      await makeRequest(`${baseUrl}/health`);
      console.log('✅ Environment accessible');
    } catch (error) {
      console.log(`❌ Environment not accessible: ${error.message}`);
      continue;
    }

    // Run all production endpoint tests
    await testPublicEndpoints(baseUrl);
    await testUnauthenticatedEndpoints(baseUrl);
    await testUnauthorizedAccess(baseUrl);
    await testStripeIntegration(baseUrl);
    await testBlogEndpoints(baseUrl);
  }

  // Print final results
  console.log('\n============================================================');
  console.log('📊 PRODUCTION-ONLY TEST RESULTS');
  console.log('============================================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📝 Total:  ${results.passed + results.failed}`);

  if (results.failures.length > 0) {
    console.log('\n🔍 FAILURE DETAILS:');
    results.failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure}`);
    });
  }

  const successRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
  console.log(`\n📈 Success Rate: ${successRate}%`);

  if (results.failed === 0) {
    console.log('\n🎉 ALL PRODUCTION TESTS PASSED! Platform is production-ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Review failures before production deployment.');
  }
}

// Run the tests
runProductionTests().catch(console.error);