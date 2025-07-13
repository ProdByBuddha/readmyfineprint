#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testSubscriptionEndpoint(sessionId: string): Promise<void> {
  console.log(`🔍 Testing subscription endpoint for session: ${sessionId}`);
  
  try {
    const response = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      const data = response.data;
      console.log(`✅ Subscription data received:`);
      console.log(`   Tier: ${data.tier.name} (${data.tier.id})`);
      console.log(`   Documents limit: ${data.tier.limits.documentsPerMonth}`);
      console.log(`   Documents used: ${data.usage.documentsAnalyzed}`);
      console.log(`   Reset date: ${data.usage.resetDate}`);
      console.log(`   Can upgrade: ${data.canUpgrade}`);
      
      if (data.tier.limits.documentsPerMonth === 10) {
        console.log(`✅ Monthly limit is correctly set to 10 documents`);
      } else {
        console.log(`❌ Monthly limit is ${data.tier.limits.documentsPerMonth}, expected 10`);
      }
      
      return data;
    } else {
      console.log(`❌ Unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
  }
}

async function simulateDocumentAnalysis(sessionId: string, count: number): Promise<void> {
  console.log(`\n🧪 Simulating ${count} document analyses to test monthly limit...`);
  
  for (let i = 1; i <= count; i++) {
    console.log(`\n📄 Creating and analyzing document ${i}...`);
    
    // Create document
    try {
      const createResponse = await axios.post(`${BASE_URL}/api/documents`, {
        title: `Test Document ${i}`,
        content: `This is test document ${i} for monthly limit testing.`,
        type: 'text'
      }, {
        headers: {
          'X-Session-ID': sessionId,
          'Content-Type': 'application/json'
        }
      });

      if (createResponse.status === 200) {
        console.log(`✅ Document ${i} created (ID: ${createResponse.data.id})`);
        
        // Analyze document
        try {
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
            console.log(`✅ Document ${i} analyzed successfully`);
          } else {
            console.log(`❌ Document ${i} analysis failed: ${analyzeResponse.status}`);
          }
        } catch (analyzeError: any) {
          if (analyzeError.response?.status === 429) {
            const data = analyzeError.response.data;
            console.log(`❌ Document ${i} analysis failed - Monthly limit reached!`);
            console.log(`   Error: ${data.error}`);
            console.log(`   Limit: ${data.limit}`);
            console.log(`   Used: ${data.used}`);
            console.log(`   Reset date: ${data.resetDate}`);
            break;
          } else {
            console.log(`❌ Document ${i} analysis failed: ${analyzeError.response?.data?.error || analyzeError.message}`);
          }
        }
      } else {
        console.log(`❌ Document ${i} creation failed: ${createResponse.status}`);
      }
    } catch (createError: any) {
      console.log(`❌ Document ${i} creation failed: ${createError.response?.data?.error || createError.message}`);
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function main() {
  console.log('🚀 Fast Anonymous User Monthly Limit Test\n');
  
  // Generate a unique session ID for this test
  const sessionId = 'test-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  console.log(`📱 Using session ID: ${sessionId}\n`);
  
  // Test 1: Check subscription endpoint
  console.log('=== Test 1: Check subscription endpoint ===');
  await testSubscriptionEndpoint(sessionId);
  
  // Test 2: Simulate document analyses
  console.log('\n=== Test 2: Simulate document analyses ===');
  await simulateDocumentAnalysis(sessionId, 12); // Try 12 documents, should fail after 10
  
  // Test 3: Check subscription endpoint again
  console.log('\n=== Test 3: Check subscription endpoint after analyses ===');
  await testSubscriptionEndpoint(sessionId);
  
  console.log('\n🎯 Test Complete');
}

// Run the test
main(); 