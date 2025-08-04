#!/usr/bin/env node

/**
 * Test document analysis rate limiting enforcement
 * This tests both the /api/document/analyze (simple) and /api/documents/:id/analyze (full) endpoints
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

console.log(`🧪 Testing Document Rate Limiting on ${BASE_URL}`);
console.log('===============================================');

async function testSimpleAnalysisEndpoint() {
  console.log('\n📋 Testing /api/document/analyze endpoint (simple test endpoint)');
  
  const testContent = 'This is a test contract for rate limiting verification.';
  
  // Test free tier limit (should allow up to 10 documents per month)
  let successCount = 0;
  let limitReached = false;
  
  for (let i = 1; i <= 15; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/document/analyze`, {
        content: testContent,
        filename: `Test Document ${i}`
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200) {
        successCount++;
        const tierInfo = response.data.analysis?.tierInfo;
        if (tierInfo) {
          console.log(`✅ Document ${i}: Success (${tierInfo.documentsUsed}/${tierInfo.documentsLimit} used, ${tierInfo.remainingDocuments} remaining)`);
        } else {
          console.log(`✅ Document ${i}: Success`);
        }
      }
    } catch (error) {
      if (error.response?.status === 429) {
        limitReached = true;
        const data = error.response.data;
        console.log(`🛑 Document ${i}: Rate limit reached!`);
        console.log(`   Error: ${data.error}`);
        console.log(`   Limit: ${data.limit}`);
        console.log(`   Used: ${data.used}`);
        console.log(`   Reset Date: ${data.resetDate}`);
        console.log(`   Upgrade Required: ${data.upgradeRequired}`);
        break;
      } else {
        console.log(`❌ Document ${i}: Error - ${error.response?.data?.error || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 Simple Endpoint Results:`);
  console.log(`   ✅ Successful analyses: ${successCount}`);
  console.log(`   🛑 Rate limit reached: ${limitReached ? 'Yes' : 'No'}`);
  
  if (limitReached && successCount === 10) {
    console.log(`   ✅ RATE LIMITING WORKING CORRECTLY (10 free documents allowed)`);
  } else if (!limitReached && successCount >= 10) {
    console.log(`   ❌ RATE LIMITING NOT WORKING (should limit to 10 documents)`);
  } else {
    console.log(`   ⚠️  Unexpected result: ${successCount} successes, limit reached: ${limitReached}`);
  }
}

async function testFullAnalysisEndpoint() {
  console.log('\n📋 Testing /api/documents/:id/analyze endpoint (full endpoint)');
  
  // First create a document
  let documentId;
  try {
    const createResponse = await axios.post(`${BASE_URL}/api/documents`, {
      title: 'Rate Limit Test Document',
      content: 'This is a test contract for rate limiting verification on the full endpoint.',
      fileType: 'text'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (createResponse.status === 200) {
      documentId = createResponse.data.id;
      console.log(`✅ Created test document with ID: ${documentId}`);
    } else {
      console.log(`❌ Failed to create test document`);
      return;
    }
  } catch (error) {
    console.log(`❌ Error creating document: ${error.response?.data?.error || error.message}`);
    return;
  }
  
  // Test analysis with rate limiting
  let successCount = 0;
  let limitReached = false;
  
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/documents/${documentId}/analyze`, {
        testMode: true // Skip OpenAI calls for testing
      }, {
        headers: {
          'X-Skip-OpenAI': 'true',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200) {
        successCount++;
        console.log(`✅ Analysis ${i}: Success`);
        
        // Check usage info if available
        if (response.data.usage) {
          console.log(`   Usage: ${response.data.usage.documentsUsed}/${response.data.usage.documentsLimit}`);
        }
      }
    } catch (error) {
      if (error.response?.status === 429) {
        limitReached = true;
        const data = error.response.data;
        console.log(`🛑 Analysis ${i}: Rate limit reached!`);
        console.log(`   Error: ${data.error}`);
        console.log(`   Limit: ${data.limit}`);
        console.log(`   Used: ${data.used}`);
        break;
      } else {
        console.log(`❌ Analysis ${i}: Error - ${error.response?.data?.error || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 Full Endpoint Results:`);
  console.log(`   ✅ Successful analyses: ${successCount}`);
  console.log(`   🛑 Rate limit reached: ${limitReached ? 'Yes' : 'No'}`);
}

async function runTests() {
  try {
    console.log('🔄 Starting rate limiting tests...\n');
    
    await testSimpleAnalysisEndpoint();
    await testFullAnalysisEndpoint();
    
    console.log('\n🎯 Test Summary:');
    console.log('================');
    console.log('✅ Rate limiting tests completed');
    console.log('📋 Check the results above to verify proper enforcement');
    console.log('🔍 Free tier should be limited to 10 documents per month');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();