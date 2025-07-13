#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testOneDocumentPerUser() {
  console.log('🧪 Final Individual Tracking Test\n');
  
  // Create two unique users
  const timestamp = Date.now();
  const userA = `test-session-${timestamp}-A`;
  const userB = `test-session-${timestamp}-B`;
  
  console.log(`User A: ${userA}`);
  console.log(`User B: ${userB}`);
  
  try {
    // Check initial usage
    console.log('\n=== Initial Usage ===');
    const initialA = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: { 'X-Session-ID': userA }
    });
    const initialB = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: { 'X-Session-ID': userB }
    });
    
    console.log(`User A initial: ${initialA.data.usage.documentsAnalyzed} documents`);
    console.log(`User B initial: ${initialB.data.usage.documentsAnalyzed} documents`);
    
    // Process one document for User A
    console.log('\n=== Processing User A Document ===');
    const docA = await axios.post(`${BASE_URL}/api/documents`, {
      title: 'Test A', content: 'Test content A', type: 'text'
    }, { headers: { 'X-Session-ID': userA } });
    
    await axios.post(`${BASE_URL}/api/documents/${docA.data.id}/analyze`, 
      { testMode: true }, 
      { headers: { 'X-Session-ID': userA, 'X-Skip-OpenAI': 'true' } }
    );
    console.log('User A document processed');
    
    // Wait a moment for tracking
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check usage after User A
    const afterA_A = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: { 'X-Session-ID': userA }
    });
    const afterA_B = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: { 'X-Session-ID': userB }
    });
    
    console.log(`After User A: User A has ${afterA_A.data.usage.documentsAnalyzed}, User B has ${afterA_B.data.usage.documentsAnalyzed}`);
    
    // Process one document for User B
    console.log('\n=== Processing User B Document ===');
    const docB = await axios.post(`${BASE_URL}/api/documents`, {
      title: 'Test B', content: 'Test content B', type: 'text'
    }, { headers: { 'X-Session-ID': userB } });
    
    await axios.post(`${BASE_URL}/api/documents/${docB.data.id}/analyze`, 
      { testMode: true }, 
      { headers: { 'X-Session-ID': userB, 'X-Skip-OpenAI': 'true' } }
    );
    console.log('User B document processed');
    
    // Wait a moment for tracking
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Final check
    const finalA = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: { 'X-Session-ID': userA }
    });
    const finalB = await axios.get(`${BASE_URL}/api/user/subscription`, {
      headers: { 'X-Session-ID': userB }
    });
    
    console.log('\n=== Final Results ===');
    console.log(`User A final: ${finalA.data.usage.documentsAnalyzed} documents`);
    console.log(`User B final: ${finalB.data.usage.documentsAnalyzed} documents`);
    
    // Analysis
    const userA_increase = finalA.data.usage.documentsAnalyzed - initialA.data.usage.documentsAnalyzed;
    const userB_increase = finalB.data.usage.documentsAnalyzed - initialB.data.usage.documentsAnalyzed;
    
    console.log('\n🎯 Analysis:');
    console.log(`User A increase: ${userA_increase}`);
    console.log(`User B increase: ${userB_increase}`);
    
    if (userA_increase === 1 && userB_increase === 1) {
      console.log('✅ SUCCESS: Individual tracking confirmed!');
      console.log('   Each user has their own separate monthly limit');
    } else {
      console.log('❌ Individual tracking not working as expected');
    }
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testOneDocumentPerUser(); 