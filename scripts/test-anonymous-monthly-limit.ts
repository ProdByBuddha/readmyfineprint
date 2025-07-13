#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

interface TestResult {
  success: boolean;
  documentsCreated: number;
  limitReached: boolean;
  limitValue?: number;
  usageCount?: number;
  error?: string;
}

async function createTestDocument(sessionId: string, testNumber: number): Promise<{ success: boolean; documentId?: number; error?: string }> {
  try {
    const response = await axios.post(`${BASE_URL}/api/documents`, {
      title: `Test Document ${testNumber}`,
      content: `This is test document ${testNumber} for monthly limit testing.`,
      type: 'text'
    }, {
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      return { success: true, documentId: response.data.id };
    } else {
      return { success: false, error: `Unexpected status: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

async function analyzeDocument(sessionId: string, documentId: number): Promise<{ success: boolean; error?: string; limitReached?: boolean; limitValue?: number; usageCount?: number }> {
  try {
    const response = await axios.post(`${BASE_URL}/api/documents/${documentId}/analyze`, {
      testMode: true // Skip OpenAI calls
    }, {
      headers: {
        'X-Session-ID': sessionId,
        'X-Skip-OpenAI': 'true',
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      return { success: true };
    } else {
      return { success: false, error: `Unexpected status: ${response.status}` };
    }
  } catch (error: any) {
    if (error.response?.status === 429) {
      // Rate limit reached
      const data = error.response.data;
      return { 
        success: false, 
        limitReached: true,
        limitValue: data.limit,
        usageCount: data.used,
        error: data.error 
      };
    }
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

async function testAnonymousMonthlyLimit(): Promise<TestResult> {
  console.log('🧪 Testing anonymous user monthly limit (should be 10 documents)...\n');
  
  // Generate a unique session ID for this test
  const sessionId = 'test-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  console.log(`📱 Using session ID: ${sessionId}`);
  
  let documentsCreated = 0;
  let limitReached = false;
  let limitValue: number | undefined;
  let usageCount: number | undefined;
  let lastError: string | undefined;
  
  // Try to create and analyze 15 documents (should fail after 10)
  for (let i = 1; i <= 15; i++) {
    console.log(`\n📄 Attempting to create and analyze document ${i}...`);
    
    // Create document
    const createResult = await createTestDocument(sessionId, i);
    if (!createResult.success) {
      console.log(`❌ Document creation failed at ${i}: ${createResult.error}`);
      return {
        success: false,
        documentsCreated,
        limitReached: false,
        error: createResult.error
      };
    }
    
    console.log(`✅ Document ${i} created successfully (ID: ${createResult.documentId})`);
    
    // Wait 7 seconds to avoid rate limiting (10 per minute = 6 second intervals)
    console.log(`⏳ Waiting 7 seconds to avoid rate limiting...`);
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    // Analyze document
    const analyzeResult = await analyzeDocument(sessionId, createResult.documentId!);
    if (!analyzeResult.success) {
      if (analyzeResult.limitReached) {
        console.log(`❌ Document analysis failed at ${i}: ${analyzeResult.error}`);
        limitReached = true;
        limitValue = analyzeResult.limitValue;
        usageCount = analyzeResult.usageCount;
        lastError = analyzeResult.error;
        break;
      } else {
        console.log(`❌ Document analysis failed at ${i}: ${analyzeResult.error}`);
        return {
          success: false,
          documentsCreated,
          limitReached: false,
          error: analyzeResult.error
        };
      }
    }
    
    console.log(`✅ Document ${i} analyzed successfully`);
    documentsCreated++;
  }
  
  console.log(`\n📊 Test Results:`);
  console.log(`   Documents successfully processed: ${documentsCreated}`);
  console.log(`   Monthly limit reached: ${limitReached ? 'Yes' : 'No'}`);
  if (limitReached) {
    console.log(`   Limit value: ${limitValue}`);
    console.log(`   Usage count: ${usageCount}`);
    console.log(`   Error message: ${lastError}`);
  }
  
  return {
    success: true,
    documentsCreated,
    limitReached,
    limitValue,
    usageCount,
    error: lastError
  };
}

async function main() {
  console.log('🚀 Anonymous User Monthly Limit Test\n');
  
  try {
    const result = await testAnonymousMonthlyLimit();
    
    if (!result.success) {
      console.log(`\n❌ Test failed: ${result.error}`);
      process.exit(1);
    }
    
    console.log('\n🎯 Test Analysis:');
    
    if (result.limitReached && result.limitValue === 10) {
      console.log('✅ SUCCESS: Anonymous users are properly limited to 10 documents per month');
      console.log(`   - Processed ${result.documentsCreated} documents before limit was enforced`);
      console.log(`   - Limit correctly set to ${result.limitValue}`);
      console.log(`   - Usage count: ${result.usageCount}`);
    } else if (result.limitReached && result.limitValue !== 10) {
      console.log(`⚠️  WARNING: Limit was reached but value is ${result.limitValue}, expected 10`);
      console.log(`   - Processed ${result.documentsCreated} documents before limit was enforced`);
    } else if (!result.limitReached && result.documentsCreated >= 10) {
      console.log('❌ FAILURE: No monthly limit was enforced for anonymous users');
      console.log(`   - Processed ${result.documentsCreated} documents without hitting limit`);
      console.log('   - This is a security issue - anonymous users should be limited to 10/month');
    } else {
      console.log('❓ INCONCLUSIVE: Test ended before reaching expected limit');
      console.log(`   - Processed ${result.documentsCreated} documents`);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
main(); 