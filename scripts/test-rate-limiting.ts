#!/usr/bin/env tsx

/**
 * Rate Limiting Test Script
 * Tests rate limiting for all subscription tiers without making OpenAI API calls
 */

import { performance } from 'perf_hooks';

interface TestResult {
  tier: string;
  testName: string;
  success: boolean;
  responseTime: number;
  statusCode: number;
  message: string;
  details?: any;
}

interface RateLimitResponse {
  success?: boolean;
  error?: string;
  limit?: number;
  used?: number;
  resetDate?: string;
  suggestedUpgrade?: any;
  queueStats?: any;
}

class RateLimitTester {
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Test rate limiting for a specific tier
   */
  async testTierRateLimit(tier: string, documentsToTest: number = 15): Promise<TestResult[]> {
    console.log(`\n🧪 Testing ${tier.toUpperCase()} tier rate limiting...`);
    
    const tierResults: TestResult[] = [];
    
    // Create a mock document for testing
    const mockDocument = {
      content: "This is a test document for rate limiting. ".repeat(50),
      title: `Rate Limit Test Document - ${tier}`,
      filename: `test-${tier}-${Date.now()}.txt`
    };

    // Test rapid-fire requests to trigger rate limiting
    for (let i = 1; i <= documentsToTest; i++) {
      const startTime = performance.now();
      
      try {
        // Create a document first
        const createResponse = await fetch(`${this.baseUrl}/api/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Tier': tier, // Custom header to simulate tier
            'User-Agent': `RateLimitTester-${tier}-${i}`,
          },
          body: JSON.stringify(mockDocument)
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create document: ${createResponse.status}`);
        }

        const createData = await createResponse.json();
        const documentId = createData.id;

        // Now try to analyze the document
        const analyzeResponse = await fetch(`${this.baseUrl}/api/documents/${documentId}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Tier': tier,
            'X-Skip-OpenAI': 'true', // Skip actual OpenAI calls
            'User-Agent': `RateLimitTester-${tier}-${i}`,
          },
          body: JSON.stringify({
            skipOpenAI: true, // Flag to skip OpenAI processing
            testMode: true
          })
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const responseData: RateLimitResponse = await analyzeResponse.json();
        
        const result: TestResult = {
          tier,
          testName: `Document ${i}/${documentsToTest}`,
          success: analyzeResponse.ok,
          responseTime,
          statusCode: analyzeResponse.status,
          message: responseData.error || 'Success',
          details: {
            limit: responseData.limit,
            used: responseData.used,
            resetDate: responseData.resetDate,
            queueStats: responseData.queueStats
          }
        };

        tierResults.push(result);
        
        // Log progress
        const status = analyzeResponse.ok ? '✅' : '❌';
        const limitInfo = responseData.limit ? `(${responseData.used}/${responseData.limit})` : '';
        console.log(`  ${status} Request ${i}: ${analyzeResponse.status} ${limitInfo} - ${responseTime.toFixed(0)}ms`);
        
        // If we hit rate limit, log details and continue
        if (analyzeResponse.status === 429) {
          console.log(`    📊 Rate limit hit: ${responseData.error}`);
          if (responseData.suggestedUpgrade) {
            console.log(`    💡 Suggested upgrade: ${responseData.suggestedUpgrade.name}`);
          }
        }

        // Small delay to avoid overwhelming the server
        await this.sleep(100);

      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const result: TestResult = {
          tier,
          testName: `Document ${i}/${documentsToTest}`,
          success: false,
          responseTime,
          statusCode: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { error: error }
        };

        tierResults.push(result);
        console.log(`  ❌ Request ${i}: Error - ${error}`);
      }
    }

    this.results.push(...tierResults);
    return tierResults;
  }

  /**
   * Test API rate limiting (general endpoints)
   */
  async testAPIRateLimit(): Promise<TestResult[]> {
    console.log(`\n🌐 Testing API rate limiting...`);
    
    const apiResults: TestResult[] = [];
    const maxRequests = 120; // Should exceed the 100 requests per 15 minutes limit
    
    for (let i = 1; i <= maxRequests; i++) {
      const startTime = performance.now();
      
      try {
        const response = await fetch(`${this.baseUrl}/api/user/profile`, {
          method: 'GET',
          headers: {
            'User-Agent': `RateLimitTester-API-${i}`,
          }
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const result: TestResult = {
          tier: 'API',
          testName: `API Request ${i}/${maxRequests}`,
          success: response.ok,
          responseTime,
          statusCode: response.status,
          message: response.ok ? 'Success' : 'Rate limited',
        };

        apiResults.push(result);
        
        if (i % 10 === 0 || response.status === 429) {
          const status = response.ok ? '✅' : '❌';
          console.log(`  ${status} Request ${i}: ${response.status} - ${responseTime.toFixed(0)}ms`);
        }

        if (response.status === 429) {
          console.log(`    📊 API rate limit hit at request ${i}`);
          break; // Stop when rate limit is hit
        }

        // No delay for API tests to trigger rate limiting faster
        if (i % 20 === 0) {
          await this.sleep(50); // Small delay every 20 requests
        }

      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const result: TestResult = {
          tier: 'API',
          testName: `API Request ${i}/${maxRequests}`,
          success: false,
          responseTime,
          statusCode: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
        };

        apiResults.push(result);
        console.log(`  ❌ Request ${i}: Error - ${error}`);
      }
    }

    this.results.push(...apiResults);
    return apiResults;
  }

  /**
   * Test collective free tier rate limiting
   */
  async testCollectiveFreeRateLimit(): Promise<TestResult[]> {
    console.log(`\n👥 Testing collective free tier rate limiting...`);
    
    const collectiveResults: TestResult[] = [];
    const maxRequests = 15; // Test the collective user service limits
    
    for (let i = 1; i <= maxRequests; i++) {
      const startTime = performance.now();
      
      try {
        // Simulate different anonymous users
        const sessionId = `test-session-${i}-${Date.now()}`;
        const deviceFingerprint = `test-device-${i}`;
        
        const response = await fetch(`${this.baseUrl}/api/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
            'X-Device-Fingerprint': deviceFingerprint,
            'User-Agent': `CollectiveTester-${i}`,
          },
          body: JSON.stringify({
            content: `Test document ${i} for collective rate limiting`,
            title: `Collective Test ${i}`,
            filename: `collective-test-${i}.txt`
          })
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const result: TestResult = {
          tier: 'Collective-Free',
          testName: `Collective Request ${i}/${maxRequests}`,
          success: response.ok,
          responseTime,
          statusCode: response.status,
          message: response.ok ? 'Success' : 'Rate limited',
        };

        collectiveResults.push(result);
        
        const status = response.ok ? '✅' : '❌';
        console.log(`  ${status} Request ${i}: ${response.status} - ${responseTime.toFixed(0)}ms`);

        if (response.status === 429) {
          const responseData = await response.json();
          console.log(`    📊 Collective rate limit: ${responseData.error}`);
        }

        await this.sleep(200); // Slightly longer delay for collective testing

      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const result: TestResult = {
          tier: 'Collective-Free',
          testName: `Collective Request ${i}/${maxRequests}`,
          success: false,
          responseTime,
          statusCode: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
        };

        collectiveResults.push(result);
        console.log(`  ❌ Request ${i}: Error - ${error}`);
      }
    }

    this.results.push(...collectiveResults);
    return collectiveResults;
  }

  /**
   * Generate comprehensive test report
   */
  generateReport(): void {
    console.log(`\n📊 RATE LIMITING TEST REPORT`);
    console.log(`${'='.repeat(60)}`);
    
    const tierGroups = this.groupResultsByTier();
    
    for (const [tier, results] of Object.entries(tierGroups)) {
      console.log(`\n📋 ${tier.toUpperCase()} TIER RESULTS:`);
      
      const totalRequests = results.length;
      const successfulRequests = results.filter(r => r.success).length;
      const rateLimitedRequests = results.filter(r => r.statusCode === 429).length;
      const errorRequests = results.filter(r => !r.success && r.statusCode !== 429).length;
      
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalRequests;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));
      const minResponseTime = Math.min(...results.map(r => r.responseTime));
      
      console.log(`  📈 Total Requests: ${totalRequests}`);
      console.log(`  ✅ Successful: ${successfulRequests} (${((successfulRequests/totalRequests)*100).toFixed(1)}%)`);
      console.log(`  ⏱️  Rate Limited: ${rateLimitedRequests} (${((rateLimitedRequests/totalRequests)*100).toFixed(1)}%)`);
      console.log(`  ❌ Errors: ${errorRequests} (${((errorRequests/totalRequests)*100).toFixed(1)}%)`);
      console.log(`  🕐 Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`  📊 Response Time Range: ${minResponseTime.toFixed(0)}ms - ${maxResponseTime.toFixed(0)}ms`);
      
      // Show when rate limiting kicked in
      const firstRateLimit = results.find(r => r.statusCode === 429);
      if (firstRateLimit) {
        const rateLimitIndex = results.indexOf(firstRateLimit) + 1;
        console.log(`  🚦 Rate limit triggered at request: ${rateLimitIndex}`);
      }
    }
    
    console.log(`\n💡 RECOMMENDATIONS:`);
    console.log(`  • Free tier should hit limits around 10-15 requests`);
    console.log(`  • Starter tier should allow ~50 requests before limiting`);
    console.log(`  • Professional tier should allow ~200 requests`);
    console.log(`  • API rate limiting should kick in around 100 requests`);
    console.log(`  • Collective free tier should have shared limits`);
  }

  /**
   * Group results by tier for analysis
   */
  private groupResultsByTier(): Record<string, TestResult[]> {
    const groups: Record<string, TestResult[]> = {};
    
    for (const result of this.results) {
      if (!groups[result.tier]) {
        groups[result.tier] = [];
      }
      groups[result.tier].push(result);
    }
    
    return groups;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log(`🚀 Starting comprehensive rate limiting tests...`);
    console.log(`📡 Testing against: ${this.baseUrl}`);
    
    try {
      // Test different subscription tiers
      await this.testTierRateLimit('free', 12);
      await this.testTierRateLimit('starter', 55);
      await this.testTierRateLimit('professional', 25); // Don't test full 200 to save time
      
      // Test API rate limiting
      await this.testAPIRateLimit();
      
      // Test collective free tier
      await this.testCollectiveFreeRateLimit();
      
      // Generate final report
      this.generateReport();
      
    } catch (error) {
      console.error(`❌ Test suite failed:`, error);
    }
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new RateLimitTester();
  tester.runAllTests()
    .then(() => {
      console.log(`\n✅ Rate limiting tests completed!`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`❌ Test suite failed:`, error);
      process.exit(1);
    });
}

export { RateLimitTester }; 