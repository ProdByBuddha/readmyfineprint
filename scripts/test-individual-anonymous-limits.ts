#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function createAndAnalyzeDocument(sessionId: string, testNumber: number): Promise<{ success: boolean; error?: string; limitReached?: boolean; limitValue?: number; usageCount?: number }> {
  try {
    // Create document
    const createResponse = await axios.post(`${BASE_URL}/api/documents`, {
      title: `Test Document ${testNumber}`,
      content: `This is test document ${testNumber} for individual anonymous user testing.`,
      type: 'text'
    }, {
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json'
      }
    });

    if (createResponse.status !== 200) {
      return { success: false, error: `Document creation failed: ${createResponse.status}` };
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Analyze document
    const analyzeResponse = await axios.post(`${BASE_URL}/api/documents/${createResponse.data.id}/analyze`, {
      testMode: true
    }, {
      headers: {
        'X-Session-ID': sessionId,
        'X-Skip-OpenAI': 'true',
        'Content-Type': 'application/json'
      }
    });

    if (analyzeResponse.status === 200) {
      return { success: true };
    } else {
      return { success: false, error: `Analysis failed: ${analyzeResponse.status}` };
    }
  } catch (error: any) {
    if (error.response?.status === 429) {
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

async function testAnonymousUser(userLabel: string, sessionId: string, maxDocuments: number = 12): Promise<{
  userLabel: string;
  sessionId: string;
  documentsProcessed: number;
  limitReached: boolean;
  limitValue?: number;
  usageCount?: number;
  error?: string;
}> {
  console.log(`\n🧪 Testing ${userLabel} (Session: ${sessionId})`);
  
  let documentsProcessed = 0;
  let limitReached = false;
  let limitValue: number | undefined;
  let usageCount: number | undefined;
  let lastError: string | undefined;
  
  for (let i = 1; i <= maxDocuments; i++) {
    console.log(`📄 ${userLabel}: Creating and analyzing document ${i}...`);
    
    const result = await createAndAnalyzeDocument(sessionId, i);
    
    if (result.success) {
      documentsProcessed++;
      console.log(`✅ ${userLabel}: Document ${i} processed successfully`);
    } else if (result.limitReached) {
      console.log(`❌ ${userLabel}: Monthly limit reached at document ${i}`);
      limitReached = true;
      limitValue = result.limitValue;
      usageCount = result.usageCount;
      lastError = result.error;
      break;
    } else {
      console.log(`❌ ${userLabel}: Error at document ${i}: ${result.error}`);
      lastError = result.error;
      break;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return {
    userLabel,
    sessionId,
    documentsProcessed,
    limitReached,
    limitValue,
    usageCount,
    error: lastError
  };
}

async function main() {
  console.log('🚀 Individual Anonymous User Limits Test\n');
  console.log('This test verifies that each anonymous user gets their own 10 document monthly limit.\n');
  
  // Generate unique session IDs for two different anonymous users
  const timestamp = Date.now();
  const userA_SessionId = `test-session-${timestamp}-userA-${Math.random().toString(36).substr(2, 9)}`;
  const userB_SessionId = `test-session-${timestamp}-userB-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`👤 Anonymous User A: ${userA_SessionId}`);
  console.log(`👤 Anonymous User B: ${userB_SessionId}`);
  
  try {
    // Test users sequentially to avoid rate limiting issues
    console.log('\n=== Testing User A First ===');
    const resultA = await testAnonymousUser('User A', userA_SessionId, 12);
    
    console.log('\n=== Testing User B Second ===');
    const resultB = await testAnonymousUser('User B', userB_SessionId, 12);
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    console.log(`\n${resultA.userLabel}:`);
    console.log(`   Documents processed: ${resultA.documentsProcessed}`);
    console.log(`   Monthly limit reached: ${resultA.limitReached ? 'Yes' : 'No'}`);
    if (resultA.limitReached) {
      console.log(`   Limit value: ${resultA.limitValue}`);
      console.log(`   Usage count: ${resultA.usageCount}`);
    }
    if (resultA.error) {
      console.log(`   Error: ${resultA.error}`);
    }
    
    console.log(`\n${resultB.userLabel}:`);
    console.log(`   Documents processed: ${resultB.documentsProcessed}`);
    console.log(`   Monthly limit reached: ${resultB.limitReached ? 'Yes' : 'No'}`);
    if (resultB.limitReached) {
      console.log(`   Limit value: ${resultB.limitValue}`);
      console.log(`   Usage count: ${resultB.usageCount}`);
    }
    if (resultB.error) {
      console.log(`   Error: ${resultB.error}`);
    }
    
    console.log('\n🎯 Analysis:');
    
    // Check if both users can process documents independently
    const bothUsersProcessedDocuments = resultA.documentsProcessed > 0 && resultB.documentsProcessed > 0;
    const totalDocumentsProcessed = resultA.documentsProcessed + resultB.documentsProcessed;
    const bothUsersHitLimit = resultA.limitReached && resultB.limitReached;
    const correctLimit = (resultA.limitValue === 10 || !resultA.limitReached) && 
                        (resultB.limitValue === 10 || !resultB.limitReached);
    
    console.log(`📈 Total documents processed by both users: ${totalDocumentsProcessed}`);
    
    if (bothUsersProcessedDocuments) {
      if (totalDocumentsProcessed > 10) {
        console.log('✅ SUCCESS: Individual anonymous users have separate monthly limits');
        console.log(`   - Combined processing of ${totalDocumentsProcessed} documents proves they are tracked separately`);
        console.log(`   - If they shared a limit, total would be max 10 documents`);
        console.log(`   - User A: ${resultA.documentsProcessed} documents`);
        console.log(`   - User B: ${resultB.documentsProcessed} documents`);
      } else if (totalDocumentsProcessed === 10 && bothUsersProcessedDocuments) {
        console.log('⚠️  INCONCLUSIVE: Could be individual limits or shared limit');
        console.log(`   - Both users processed documents, but total is exactly 10`);
        console.log(`   - Need more testing to determine if limits are truly separate`);
      } else {
        console.log('❌ POSSIBLE SHARED LIMIT: Total documents suggest shared limit');
        console.log(`   - Total: ${totalDocumentsProcessed} documents (should be >10 for individual limits)`);
      }
    } else {
      console.log('❌ FAILURE: One or both users could not process documents');
    }
    
    if (bothUsersHitLimit && correctLimit) {
      console.log('✅ Monthly limit enforcement is working correctly');
    } else if (!correctLimit) {
      console.log('⚠️  Note: Limit values may be undefined due to rate limiting interference');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
main(); 