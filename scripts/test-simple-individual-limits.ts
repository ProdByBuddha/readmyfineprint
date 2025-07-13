#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function checkUserSubscription(sessionId: string): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    console.error(`Error checking subscription for ${sessionId}:`, error.message);
    return null;
  }
}

async function createAndAnalyzeOneDocument(sessionId: string): Promise<boolean> {
  try {
    // Create document
    const createResponse = await axios.post(`${BASE_URL}/api/documents`, {
      title: `Test Document`,
      content: `This is a test document for ${sessionId}.`,
      type: 'text'
    }, {
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json'
      }
    });

    if (createResponse.status !== 200) {
      return false;
    }

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

    return analyzeResponse.status === 200;
  } catch (error: any) {
    console.error(`Error processing document for ${sessionId}:`, error.response?.data?.error || error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Simple Individual Anonymous User Test\n');
  
  // Generate unique session IDs for two different anonymous users
  const timestamp = Date.now();
  const userA_SessionId = `test-session-${timestamp}-userA-${Math.random().toString(36).substr(2, 9)}`;
  const userB_SessionId = `test-session-${timestamp}-userB-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`👤 Anonymous User A: ${userA_SessionId}`);
  console.log(`👤 Anonymous User B: ${userB_SessionId}`);
  
  // Check initial usage for both users
  console.log('\n=== Initial Usage Check ===');
  const initialA = await checkUserSubscription(userA_SessionId);
  const initialB = await checkUserSubscription(userB_SessionId);
  
  console.log(`User A initial usage: ${initialA?.usage?.documentsAnalyzed || 0} documents`);
  console.log(`User B initial usage: ${initialB?.usage?.documentsAnalyzed || 0} documents`);
  
  // Process one document for each user
  console.log('\n=== Processing Documents ===');
  
  console.log('Processing document for User A...');
  const successA = await createAndAnalyzeOneDocument(userA_SessionId);
  console.log(`User A document processing: ${successA ? 'SUCCESS' : 'FAILED'}`);
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  console.log('Processing document for User B...');
  const successB = await createAndAnalyzeOneDocument(userB_SessionId);
  console.log(`User B document processing: ${successB ? 'SUCCESS' : 'FAILED'}`);
  
  // Check usage after processing
  console.log('\n=== Final Usage Check ===');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for tracking to complete
  
  const finalA = await checkUserSubscription(userA_SessionId);
  const finalB = await checkUserSubscription(userB_SessionId);
  
  console.log(`User A final usage: ${finalA?.usage?.documentsAnalyzed || 0} documents`);
  console.log(`User B final usage: ${finalB?.usage?.documentsAnalyzed || 0} documents`);
  
  // Analysis
  console.log('\n🎯 Analysis:');
  
  const userA_Increase = (finalA?.usage?.documentsAnalyzed || 0) - (initialA?.usage?.documentsAnalyzed || 0);
  const userB_Increase = (finalB?.usage?.documentsAnalyzed || 0) - (initialB?.usage?.documentsAnalyzed || 0);
  
  console.log(`User A usage increase: ${userA_Increase}`);
  console.log(`User B usage increase: ${userB_Increase}`);
  
  if (userA_Increase === 1 && userB_Increase === 1) {
    console.log('✅ SUCCESS: Each user has individual usage tracking');
    console.log('   - Both users show +1 document increase independently');
  } else if (userA_Increase === 1 && userB_Increase === 0) {
    console.log('⚠️  PARTIAL: User A tracked, User B not tracked');
  } else if (userA_Increase === 0 && userB_Increase === 1) {
    console.log('⚠️  PARTIAL: User B tracked, User A not tracked');
  } else if (userA_Increase === 0 && userB_Increase === 0) {
    console.log('❌ FAILURE: No individual tracking detected');
    console.log('   - Neither user shows usage increase');
  } else {
    console.log('❓ UNEXPECTED: Unusual usage pattern detected');
    console.log(`   - User A: +${userA_Increase}, User B: +${userB_Increase}`);
  }
  
  // Check if they have the correct monthly limit
  const limitA = finalA?.tier?.limits?.documentsPerMonth;
  const limitB = finalB?.tier?.limits?.documentsPerMonth;
  
  if (limitA === 10 && limitB === 10) {
    console.log('✅ Correct monthly limits: Both users have 10 documents/month limit');
  } else {
    console.log(`⚠️  Limit check: User A limit=${limitA}, User B limit=${limitB} (expected: 10)`);
  }
}

// Run the test
main(); 